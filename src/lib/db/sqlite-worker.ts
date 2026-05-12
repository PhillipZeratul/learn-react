import sqlite3InitModule from "@sqlite.org/sqlite-wasm"

let db: any = null

const initDb = async () => {
    try {
        const sqlite3 = await sqlite3InitModule()
        if ("opfs" in sqlite3) {
            db = new sqlite3.oo1.OpfsDb("local-routine-db.sqlite3")
            console.log("Worker: SQLite OPFS Initialized")
        } else {
            db = new sqlite3.oo1.DB("local-routine-db.sqlite3", "ct")
            console.warn("Worker: OPFS not available, using memory db")
        }
    } catch (err) {
        console.error("Worker: DB Init Error", err)
    }
}

self.onmessage = async (e: MessageEvent) => {
    const { type, query, values, id } = e.data

    if (!db) await initDb()

    try {
        if (type === "EXEC") {
            db.exec({
                sql: query,
                bind: values || [],
            })
            const changes = db.changes()
            safePostMessage({ id, success: true, changes })
        } else if (type === "SELECT") {
            const rows: any[] = []
            db.exec({
                sql: query,
                bind: values || [],
                rowMode: "object",
                callback: (row: any) => rows.push(row),
            })
            safePostMessage({ id, success: true, rows })
        }
    } catch (err: any) {
        safePostMessage({ id, success: false, error: err.message })
    }
}

function safePostMessage(message: any) {
    try {
        self.postMessage(message)
    } catch (err) {
        console.error(
            "Worker: Failed to post message (main thread likely disconnected)",
            err
        )
    }
}
