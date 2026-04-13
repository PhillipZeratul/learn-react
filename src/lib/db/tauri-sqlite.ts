import type { IDatabaseService, QueryResult } from "./types"

export class TauriDatabaseService implements IDatabaseService {
    private db: any;

    constructor(db: any) {
        this.db = db;
    }
    async execute(query: string, values?: any[]): Promise<QueryResult> {
        const result = await this.db.execute(query, values);
        return { rows: [], changes: result.rowsAffected, lastInsertId: result.lastInsertId };
    }
    async select<T>(query: string, values?: any[]): Promise<T[]> {
        return await this.db.select(query, values);
    }
    async transaction<T>(callback: (db: IDatabaseService) => Promise<T>): Promise<T> {
        return callback(this);
    }
}

export const initTauriDb = async () => {
    const Database = (await import("@tauri-apps/plugin-sql")).default;
    const db = await Database.load("sqlite:local.db");
    return new TauriDatabaseService(db);
};
