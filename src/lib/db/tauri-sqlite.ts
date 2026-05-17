import type { IDatabaseService, QueryResult } from "./types"

interface TauriDatabase {
    execute(
        query: string,
        values?: unknown[]
    ): Promise<{ rowsAffected: number; lastInsertId: number }>
    select<T>(query: string, values?: unknown[]): Promise<T[]>
}

export class TauriDatabaseService implements IDatabaseService {
    private db: TauriDatabase

    constructor(db: TauriDatabase) {
        this.db = db
    }
    async execute(query: string, values?: unknown[]): Promise<QueryResult> {
        const result = await this.db.execute(query, values)
        return {
            rows: [],
            changes: result.rowsAffected,
            lastInsertId: result.lastInsertId,
        }
    }
    async select<T>(query: string, values?: unknown[]): Promise<T[]> {
        return await this.db.select<T>(query, values)
    }
    async transaction<T>(
        callback: (db: IDatabaseService) => Promise<T>
    ): Promise<T> {
        return callback(this)
    }
}

export const initTauriDb = async () => {
    const Database = (await import("@tauri-apps/plugin-sql")).default
    const db = await Database.load("sqlite:local.db")
    return new TauriDatabaseService(db as unknown as TauriDatabase)
}
