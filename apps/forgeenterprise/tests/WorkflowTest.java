package forgeenterprise;

public final class WorkflowTest {
    private static int passed = 0;
    private static void check(String name, boolean outcome) {
        if (!outcome) throw new AssertionError(name);
        passed++; System.out.println("PASS " + name);
    }
    private static void throwsError(String name, Runnable work) {
        try { work.run(); throw new AssertionError(name + " did not reject"); }
        catch (IllegalArgumentException | IllegalStateException expected) { passed++; System.out.println("PASS " + name); }
    }
    public static void main(String[] args) {
        Workflow w = new Workflow();
        check("draft created", w.create("a", "1", "creator", 100).status() == Workflow.Status.DRAFT);
        throwsError("blank tenant", () -> w.create(" ", "2", "creator", 100));
        throwsError("nonpositive amount", () -> w.create("a", "2", "creator", 0));
        throwsError("duplicate in tenant", () -> w.create("a", "1", "creator", 50));
        check("same id separate tenants", w.create("b", "1", "creator", 150).tenant().equals("b"));
        throwsError("wrong submitter", () -> w.submit("a", "1", "stranger", Workflow.Role.REQUESTER));
        check("submit", w.submit("a", "1", "creator", Workflow.Role.REQUESTER).status() == Workflow.Status.PENDING_MANAGER);
        throwsError("double submit", () -> w.submit("a", "1", "creator", Workflow.Role.REQUESTER));
        throwsError("self approval", () -> w.review("a", "1", "creator", Workflow.Role.MANAGER, true));
        throwsError("wrong role", () -> w.review("a", "1", "finance", Workflow.Role.FINANCE, true));
        check("small approved", w.review("a", "1", "boss", Workflow.Role.MANAGER, true).status() == Workflow.Status.APPROVED);
        throwsError("immutable final state", () -> w.review("a", "1", "boss", Workflow.Role.MANAGER, true));
        w.create("a", "3", "owner", 600_000);
        w.submit("a", "3", "owner", Workflow.Role.REQUESTER);
        check("large requires finance", w.review("a", "3", "manager", Workflow.Role.MANAGER, true).status() == Workflow.Status.PENDING_FINANCE);
        throwsError("manager cannot finance", () -> w.review("a", "3", "manager", Workflow.Role.MANAGER, true));
        check("finance decision", w.review("a", "3", "accounting", Workflow.Role.FINANCE, true).status() == Workflow.Status.APPROVED);
        w.create("a", "4", "owner", 800);
        w.submit("a", "4", "owner", Workflow.Role.REQUESTER);
        check("rejection", w.review("a", "4", "boss", Workflow.Role.MANAGER, false).status() == Workflow.Status.REJECTED);
        throwsError("cross tenant isolation", () -> w.get("wrong", "3"));
        check("defensive audit copy", w.audit().size() == 11);
        check("count", w.count() == 4);
        System.out.println("TOTAL " + passed + " passed");
    }
}
