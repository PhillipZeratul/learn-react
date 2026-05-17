import type { IDatabaseService, QueryResult } from "./types"

interface CapacitorDatabase {
    run(
        query: string,
        values?: unknown[]
    ): Promise<{ changes?: { changes: number; lastId: number } }>
    query(query: string, values?: unknown[]): Promise<{ values: unknown[] }>
}

export class CapacitorDatabaseService implements IDatabaseService {
    private db: CapacitorDatabase

    constructor(db: CapacitorDatabase) {
        this.db = db
    }
    async execute(query: string, values?: unknown[]): Promise<QueryResult> {
        const result = await this.db.run(query, values)
        return {
            rows: [],
            changes: result.changes?.changes,
            lastInsertId: result.changes?.lastId,
        }
    }
    async select<T>(query: string, values?: unknown[]): Promise<T[]> {
        const result = await this.db.query(query, values)
        return (result.values as T[]) || []
    }
    async transaction<T>(
        callback: (db: IDatabaseService) => Promise<T>
    ): Promise<T> {
        return callback(this)
    }
}

export const initCapacitorDb = async () => {
    const { CapacitorSQLite, SQLiteConnection } =
        await import("@capacitor-community/sqlite")
    const sqlite = new SQLiteConnection(CapacitorSQLite)
    const db = await sqlite.createConnection(
        "localdb",
        false,
        "no-encryption",
        1,
        false
    )
    await db.open()
    return new CapacitorDatabaseService(db as unknown as CapacitorDatabase)
}
