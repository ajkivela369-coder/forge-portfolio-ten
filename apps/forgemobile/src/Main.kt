package forgemobile

fun main() {
    val queue = OfflineSync()
    queue.enqueue(Change("notes/1", "Study Kotlin offline sync", 0))
    println(queue.sync(mapOf("notes/1" to 0)))
    println(queue.snapshot())
}
