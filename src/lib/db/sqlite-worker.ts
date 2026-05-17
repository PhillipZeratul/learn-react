import sqlite3InitModule from "@sqlite.org/sqlite-wasm"

interface SQLiteDB {
    exec(options: {
        sql: string
        bind?: unknown[]
        rowMode?: "object" | "array"
        callback?: (row: Record<string, unknown>) => void
    }): void
    changes(): number
}

let db: SQLiteDB | null = null

interface SQLite3Module {
    oo1: {
        OpfsDb?: new (name: string) => SQLiteDB
        DB: new (name: string, mode: string) => SQLiteDB
    }
}

const initDb = async () => {
    try {
        const sqlite3 = (await sqlite3InitModule()) as unknown as SQLite3Module
        if (sqlite3.oo1.OpfsDb) {
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
            db!.exec({
                sql: query,
                bind: values || [],
            })
            const changes = db!.changes()
            safePostMessage({ id, success: true, changes })
        } else if (type === "SELECT") {
            const rows: Record<string, unknown>[] = []
            db!.exec({
                sql: query,
                bind: values || [],
                rowMode: "object",
                callback: (row: Record<string, unknown>) => rows.push(row),
            })
            safePostMessage({ id, success: true, rows })
        }
    } catch (err: unknown) {
        safePostMessage({ id, success: false, error: (err as Error).message })
    }
}

function safePostMessage(message: unknown) {
    try {
        self.postMessage(message)
    } catch (err) {
        console.error(
            "Worker: Failed to post message (main thread likely disconnected)",
            err
        )
    }
}
