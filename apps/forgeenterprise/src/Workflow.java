package forgeenterprise;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

/** Deterministic approval state machine. No network, database, or paid dependencies. */
public final class Workflow {
    public enum Role { REQUESTER, MANAGER, FINANCE }
    public enum Status { DRAFT, PENDING_MANAGER, PENDING_FINANCE, APPROVED, REJECTED }
    public record Snapshot(String id, String tenant, String owner, long cents, Status status) {}
    public record Audit(long sequence, String id, String actor, String action, Status status) {}

    private static final long FINANCE_THRESHOLD_CENTS = 500_000;
    private final Map<String, Item> items = new LinkedHashMap<>();
    private final List<Audit> audit = new ArrayList<>();

    private static final class Item {
        final String id, tenant, owner;
        final long cents;
        Status status = Status.DRAFT;
        Item(String id, String tenant, String owner, long cents) {
            this.id = id; this.tenant = tenant; this.owner = owner; this.cents = cents;
        }
    }

    private static String required(String v, String label) {
        if (v == null || v.isBlank()) throw new IllegalArgumentException(label + " required");
        return v.strip();
    }
    private static void ensure(boolean ok, String reason) {
        if (!ok) throw new IllegalStateException(reason);
    }
    private static String key(String tenant, String id) { return tenant + "\u001f" + id; }
    private Item item(String tenant, String id) {
        Item v = items.get(key(required(tenant, "tenant"), required(id, "id")));
        if (v == null) throw new IllegalArgumentException("request not found in tenant");
        return v;
    }
    private void log(Item item, String actor, String action) {
        audit.add(new Audit(audit.size() + 1L, item.id, actor, action, item.status));
    }
    private static Snapshot copy(Item i) { return new Snapshot(i.id, i.tenant, i.owner, i.cents, i.status); }

    public synchronized Snapshot create(String tenant, String id, String requester, long cents) {
        tenant = required(tenant, "tenant"); id = required(id, "id"); requester = required(requester, "requester");
        if (cents <= 0 || cents > 1_000_000_000_00L) throw new IllegalArgumentException("invalid amount");
        String k = key(tenant, id);
        if (items.containsKey(k)) throw new IllegalArgumentException("duplicate request id");
        Item v = new Item(id, tenant, requester, cents);
        items.put(k, v); log(v, requester, "created"); return copy(v);
    }
    public synchronized Snapshot submit(String tenant, String id, String actor, Role role) {
        Item i = item(tenant, id); actor = required(actor, "actor");
        ensure(role == Role.REQUESTER && Objects.equals(i.owner, actor), "only owner may submit");
        ensure(i.status == Status.DRAFT, "submission requires DRAFT");
        i.status = Status.PENDING_MANAGER; log(i, actor, "submitted"); return copy(i);
    }
    public synchronized Snapshot review(String tenant, String id, String actor, Role role, boolean approve) {
        Item i = item(tenant, id); actor = required(actor, "actor");
        ensure(!Objects.equals(i.owner, actor), "separation of duties: requester cannot review");
        if (i.status == Status.PENDING_MANAGER) {
            ensure(role == Role.MANAGER, "manager review required");
            i.status = approve ? (i.cents > FINANCE_THRESHOLD_CENTS ? Status.PENDING_FINANCE : Status.APPROVED) : Status.REJECTED;
        } else if (i.status == Status.PENDING_FINANCE) {
            ensure(role == Role.FINANCE, "finance review required");
            i.status = approve ? Status.APPROVED : Status.REJECTED;
        } else throw new IllegalStateException("request is not pending review");
        log(i, actor, approve ? "approved-stage" : "rejected"); return copy(i);
    }
    public synchronized Snapshot get(String tenant, String id) { return copy(item(tenant, id)); }
    public synchronized List<Audit> audit() { return List.copyOf(audit); }
    public synchronized int count() { return items.size(); }
}
