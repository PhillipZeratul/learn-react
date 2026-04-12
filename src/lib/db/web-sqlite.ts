import sqlite3InitModule from '@sqlite.org/sqlite-wasm';
import type { IDatabaseService, QueryResult } from "./types"

class WebDatabaseService implements IDatabaseService {
    private db: any = null;

    constructor() {}

    async init() {
        if (this.db) return;

        try {
            const sqlite3 = await sqlite3InitModule();

            if ('opfs' in sqlite3) {
                this.db = new sqlite3.oo1.OpfsDb('local-routine-db.sqlite3');
                console.log('SQLite WASM (OPFS) Initialized at', this.db.filename);
            } else {
                this.db = new sqlite3.oo1.DB('local-routine-db.sqlite3', 'ct');
                console.warn('OPFS not available, falling back to in-memory/IDB (transient)');
            }
        } catch (err) {
            console.error('Failed to initialize SQLite WASM:', err);
            throw err;
        }
    }

    async execute(query: string, values?: any[]): Promise<QueryResult> {
        if (!this.db) await this.init();
        
        try {
            this.db.exec({
                sql: query,
                bind: values || []
            });
            
            // For changes/lastInsertId, we might need to query them separately 
            // as exec() doesn't return them directly in this simple form
            const changes = this.db.changes();
            
            return { rows: [], changes };
        } catch (err) {
            console.error('SQL Execution Error:', err);
            throw err;
        }
    }

    async select<T>(query: string, values?: any[]): Promise<T[]> {
        if (!this.db) await this.init();

        try {
            const result: T[] = [];
            this.db.exec({
                sql: query,
                bind: values || [],
                rowMode: 'object',
                callback: (row: any) => {
                    result.push(row);
                }
            });
            return result;
        } catch (err) {
            console.error('SQL Select Error:', err);
            throw err;
        }
    }

    async transaction<T>(callback: (db: IDatabaseService) => Promise<T>): Promise<T> {
        if (!this.db) await this.init();
        
        try {
            await this.execute('BEGIN TRANSACTION');
            const result = await callback(this);
            await this.execute('COMMIT');
            return result;
        } catch (err) {
            await this.execute('ROLLBACK');
            throw err;
        }
    }
}

export const webDatabaseService = new WebDatabaseService();
