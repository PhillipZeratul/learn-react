import type { IDatabaseService, QueryResult } from "./types"

class WebDatabaseService implements IDatabaseService {
    private worker: Worker | null = null
    private messageCounter = 0
    private pendingPromises: Map<
        number,
        {
            resolve: (value: unknown) => void
            reject: (reason?: unknown) => void
        }
    > = new Map()
    private isInitializing = false
    private initPromise: Promise<void> | null = null

    constructor() {}

    async init(): Promise<void> {
        if (this.worker) return
        if (this.isInitializing) return this.initPromise!

        this.isInitializing = true
        this.initPromise = (async () => {
            try {
                // 使用 Vite 的 Worker 导入语法
                const newWorker = new Worker(
                    new URL("./sqlite-worker.ts", import.meta.url),
                    {
                        type: "module",
                    }
                )

                newWorker.onmessage = (e) => {
                    const { id, success, rows, changes, error } = e.data
                    const promise = this.pendingPromises.get(id)

                    if (promise) {
                        if (success) {
                            promise.resolve(rows || { rows: [], changes })
                        } else {
                            promise.reject(new Error(error))
                        }
                        this.pendingPromises.delete(id)
                    }
                }

                newWorker.onerror = (e) => {
                    console.error("WebDatabaseService: Worker error", e)
                    // If the worker crashes, we'll null it out so the next call re-inits
                    if (this.worker === newWorker) {
                        this.worker = null
                    }
                }

                this.worker = newWorker
            } finally {
                this.isInitializing = false
            }
        })()

        return this.initPromise
    }

    private async sendToWorker<T>(
        type: "EXEC" | "SELECT",
        query: string,
        values?: unknown[]
    ): Promise<T> {
        if (!this.worker) await this.init()

        const id = ++this.messageCounter
        return new Promise<T>((resolve, reject) => {
            this.pendingPromises.set(id, {
                resolve: resolve as (value: unknown) => void,
                reject: reject as (reason?: unknown) => void,
            })

            const attemptSend = async (retryCount = 0) => {
                try {
                    if (!this.worker) {
                        await this.init()
                    }
                    this.worker!.postMessage({ id, type, query, values })
                } catch (err: unknown) {
                    const error = err as Error
                    const isDisconnected =
                        error.message
                            ?.toLowerCase()
                            .includes("disconnected port") ||
                        error.message
                            ?.toLowerCase()
                            .includes("already been terminated") ||
                        error.name === "InvalidStateError"

                    if (isDisconnected && retryCount < 2) {
                        console.warn(
                            `WebDatabaseService: Worker disconnected (attempt ${retryCount + 1}), attempting recovery...`,
                            err
                        )
                        this.worker = null
                        this.initPromise = null // Force a fresh init
                        try {
                            await this.init()
                            await attemptSend(retryCount + 1)
                        } catch (initErr) {
                            this.pendingPromises.delete(id)
                            reject(initErr)
                        }
                    } else {
                        console.error(
                            "WebDatabaseService: Failed to send message to worker",
                            err
                        )
                        this.pendingPromises.delete(id)
                        reject(err)
                    }
                }
            }

            attemptSend()
        })
    }

    async execute(query: string, values?: unknown[]): Promise<QueryResult> {
        return this.sendToWorker<QueryResult>("EXEC", query, values)
    }

    async select<T>(query: string, values?: unknown[]): Promise<T[]> {
        return this.sendToWorker<T[]>("SELECT", query, values)
    }

    async transaction<T>(
        callback: (db: IDatabaseService) => Promise<T>
    ): Promise<T> {
        // 由于 Worker 架构的限制，简单的事务处理变得复杂
        // 这里暂时使用基础的 BEGIN/COMMIT 命令，但要注意并发问题
        await this.execute("BEGIN TRANSACTION")
        try {
            const result = await callback(this)
            await this.execute("COMMIT")
            return result
        } catch (err) {
            await this.execute("ROLLBACK")
            throw err
        }
    }
}

export const webDatabaseService = new WebDatabaseService()
