package forgemobile

private var count = 0
private fun check(name: String, valid: Boolean) {
    if (!valid) throw AssertionError(name)
    count++
    println("PASS $name")
}
private inline fun rejects(name: String, action: () -> Unit) {
    var rejected = false
    try { action() } catch (_: IllegalArgumentException) { rejected = true }
    check(name, rejected)
}
fun main() {
    val q = OfflineSync()
    check("starts empty", q.pending().isEmpty())
    rejects("no blank key") { q.enqueue(Change(" ", "x", 0)) }
    rejects("no blank body") { q.enqueue(Change("x", "", 0)) }
    rejects("no negative version") { q.enqueue(Change("x", "x", -1)) }
    rejects("bound payload size") { q.enqueue(Change("x", "y".repeat(4097), 0)) }
    q.enqueue(Change("id", "write", 0))
    q.enqueue(Change("id", "write", 0))
    check("same edit idempotent", q.pending().size == 1)
    rejects("reject competing local edit") { q.enqueue(Change("id", "other", 0)) }
    val conflict = q.sync(mapOf("id" to 3))
    check("conflict detected", conflict.conflicts == listOf("id"))
    check("conflict retained", q.pending().size == 1)
    check("remote won't clobber pending", !q.ingestRemote("id", "server", 3))
    val synced = q.sync(mapOf("id" to 0))
    check("matching revision applied", synced.applied == listOf("id"))
    check("queue cleared", synced.remaining == 0)
    check("revision advanced", q.snapshot()["id"] == ("write" to 1L))
    check("stale remote ignored", !q.ingestRemote("id", "stale", 1))
    check("newer remote adopted", q.ingestRemote("id", "newer", 5))
    check("newer body stored", q.snapshot()["id"] == ("newer" to 5L))
    q.enqueue(Change("two", "b", 0)); q.enqueue(Change("three", "c", 1))
    val partial = q.sync(mapOf("two" to 0, "three" to 0))
    check("partial apply", partial.applied == listOf("two"))
    check("partial conflict", partial.conflicts == listOf("three"))
    check("stable remaining", q.pending().map { it.key } == listOf("three"))
    println("TOTAL $count passed")
}
