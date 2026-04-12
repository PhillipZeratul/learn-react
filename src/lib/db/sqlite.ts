import type { IDatabaseService, QueryResult } from "./types"

// Platform detection using tree-shakable flags
const isTauri = import.meta.env.IS_TAURI;
const isCapacitor = import.meta.env.IS_CAPACITOR;
const isWeb = import.meta.env.IS_WEB;

class MockDatabaseService implements IDatabaseService {
    async execute(query: string, values?: any[]): Promise<QueryResult> {
        console.log(`[MOCK DB] Executing: ${query}`, values)
        return { rows: [], changes: 0 }
    }
    async select<T>(query: string, values?: any[]): Promise<T[]> {
        console.log(`[MOCK DB] Selecting: ${query}`, values)
        return []
    }
    async transaction<T>(callback: (db: IDatabaseService) => Promise<T>): Promise<T> {
        return callback(this)
    }
}

class TauriDatabaseService implements IDatabaseService {
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

class CapacitorDatabaseService implements IDatabaseService {
    private db: any;

    constructor(db: any) {
        this.db = db;
    }
    async execute(query: string, values?: any[]): Promise<QueryResult> {
        const result = await this.db.run(query, values);
        return { rows: [], changes: result.changes?.changes, lastInsertId: result.changes?.lastId };
    }
    async select<T>(query: string, values?: any[]): Promise<T[]> {
        const result = await this.db.query(query, values);
        return result.values || [];
    }
    async transaction<T>(callback: (db: IDatabaseService) => Promise<T>): Promise<T> {
        return callback(this);
    }
}

class DatabaseServiceFactory {
    private static instance: IDatabaseService | null = null;

    static async getInstance(): Promise<IDatabaseService> {
        if (this.instance) return this.instance;

        try {
            if (isTauri) {
                const Database = (await import("@tauri-apps/plugin-sql")).default;
                const db = await Database.load("sqlite:local.db");
                this.instance = new TauriDatabaseService(db);
                console.log("Tauri SQLite Initialized");
            } else if (isCapacitor) {
                const { CapacitorSQLite, SQLiteConnection } = await import('@capacitor-community/sqlite');
                const sqlite = new SQLiteConnection(CapacitorSQLite);
                const db = await sqlite.createConnection("localdb", false, "no-encryption", 1, false);
                await db.open();
                this.instance = new CapacitorDatabaseService(db);
                console.log("Capacitor SQLite Initialized");
            } else if (isWeb) {
                const { webDatabaseService } = await import('./web-sqlite');
                await webDatabaseService.init();
                this.instance = webDatabaseService;
                console.log("Web SQLite (WASM+OPFS) Initialized");
            }
        } catch (e) {
            console.error("Failed to initialize native SQLite:", e);
        }

        if (!this.instance) {
            console.warn("No native database found or initialization failed, falling back to Mock.");
            this.instance = new MockDatabaseService();
        }

        return this.instance;
    }
}

export const getDatabase = () => DatabaseServiceFactory.getInstance();
