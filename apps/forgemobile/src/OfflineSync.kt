package forgemobile

/** Offline-first mutation queue; deliberately does not connect to a remote server. */
data class Change(val key: String, val body: String, val expectedRevision: Long)
data class Attempt(val applied: List<String>, val conflicts: List<String>, val remaining: Int)

class OfflineSync {
    private val queue = linkedMapOf<String, Change>()
    private val local = linkedMapOf<String, Pair<String, Long>>()

    fun enqueue(change: Change) {
        require(change.key.isNotBlank()) { "key required" }
        require(change.body.isNotEmpty()) { "body required" }
        require(change.expectedRevision >= 0) { "invalid revision" }
        require(change.body.length <= 4096) { "body too large" }
        val previous = queue[change.key]
        require(previous == null || previous == change) { "conflicting unsynced edit" }
        queue[change.key] = change
    }

    fun pending(): List<Change> = queue.values.toList()
    fun snapshot(): Map<String, Pair<String, Long>> = local.toMap()

    /** Model a successful server compare-and-swap only when supplied revision matches. */
    fun sync(serverRevisions: Map<String, Long>): Attempt {
        val applied = mutableListOf<String>()
        val conflicts = mutableListOf<String>()
        for ((key, change) in queue) {
            val revision = serverRevisions[key] ?: 0L
            if (revision < 0L || revision != change.expectedRevision) {
                conflicts.add(key)
            } else {
                applied.add(key)
                local[key] = change.body to (revision + 1)
            }
        }
        for (key in applied) queue.remove(key)
        return Attempt(applied.toList(), conflicts.toList(), queue.size)
    }

    /** Remote updates never overwrite a locally pending change. */
    fun ingestRemote(key: String, body: String, revision: Long): Boolean {
        require(key.isNotBlank() && revision >= 0)
        if (queue.containsKey(key)) return false
        val current = local[key]
        if (current == null || revision > current.second) {
            local[key] = body to revision
            return true
        }
        return false
    }
}
