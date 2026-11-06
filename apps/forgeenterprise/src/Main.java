package forgeenterprise;

public final class Main {
    public static void main(String[] args) {
        Workflow w = new Workflow();
        w.create("demo", "REQ-001", "alex", 950_000);
        w.submit("demo", "REQ-001", "alex", Workflow.Role.REQUESTER);
        w.review("demo", "REQ-001", "manager", Workflow.Role.MANAGER, true);
        System.out.println(w.review("demo", "REQ-001", "finance", Workflow.Role.FINANCE, true));
        System.out.println("Audit events: " + w.audit().size());
    }
}
