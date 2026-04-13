import type { IDatabaseService, QueryResult } from "./types"

class WebDatabaseService implements IDatabaseService {
    private worker: Worker | null = null;
    private messageCounter = 0;
    private pendingPromises: Map<number, { resolve: Function; reject: Function }> = new Map();

    constructor() {}

    async init() {
        if (this.worker) return;

        // 使用 Vite 的 Worker 导入语法
        this.worker = new Worker(new URL('./sqlite-worker.ts', import.meta.url), {
            type: 'module'
        });

        this.worker.onmessage = (e) => {
            const { id, success, rows, changes, error } = e.data;
            const promise = this.pendingPromises.get(id);
            
            if (promise) {
                if (success) {
                    promise.resolve(rows || { rows: [], changes });
                } else {
                    promise.reject(new Error(error));
                }
                this.pendingPromises.delete(id);
            }
        };
    }

    private sendToWorker(type: 'EXEC' | 'SELECT', query: string, values?: any[]): Promise<any> {
        const id = ++this.messageCounter;
        return new Promise((resolve, reject) => {
            this.pendingPromises.set(id, { resolve, reject });
            this.worker?.postMessage({ id, type, query, values });
        });
    }

    async execute(query: string, values?: any[]): Promise<QueryResult> {
        if (!this.worker) await this.init();
        return this.sendToWorker('EXEC', query, values);
    }

    async select<T>(query: string, values?: any[]): Promise<T[]> {
        if (!this.worker) await this.init();
        return this.sendToWorker('SELECT', query, values);
    }

    async transaction<T>(callback: (db: IDatabaseService) => Promise<T>): Promise<T> {
        // 由于 Worker 架构的限制，简单的事务处理变得复杂
        // 这里暂时使用基础的 BEGIN/COMMIT 命令，但要注意并发问题
        await this.execute('BEGIN TRANSACTION');
        try {
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
