import type { IDatabaseService, QueryResult } from "./types"

// Platform detection using tree-shakable flags
const isTauri = import.meta.env.IS_TAURI
const isCapacitor = import.meta.env.IS_CAPACITOR
const isWeb = import.meta.env.IS_WEB

class MockDatabaseService implements IDatabaseService {
  async execute(query: string, values?: any[]): Promise<QueryResult> {
    console.log(`[MOCK DB] Executing: ${query}`, values)
    return { rows: [], changes: 0 }
  }
  async select<T>(query: string, values?: any[]): Promise<T[]> {
    console.log(`[MOCK DB] Selecting: ${query}`, values)
    return []
  }
  async transaction<T>(
    callback: (db: IDatabaseService) => Promise<T>
  ): Promise<T> {
    return callback(this)
  }
}

class DatabaseServiceFactory {
  private static instance: IDatabaseService | null = null

  static async getInstance(): Promise<IDatabaseService> {
    if (this.instance) return this.instance

    try {
      if (isTauri) {
        const { initTauriDb } = await import("./tauri-sqlite")
        this.instance = await initTauriDb()
        console.log("Tauri SQLite Initialized")
      } else if (isCapacitor) {
        const { initCapacitorDb } = await import("./capacitor-sqlite")
        this.instance = await initCapacitorDb()
        console.log("Capacitor SQLite Initialized")
      } else if (isWeb) {
        const { webDatabaseService } = await import("./web-sqlite")
        await webDatabaseService.init()
        this.instance = webDatabaseService
        console.log("Web SQLite (WASM+OPFS) Initialized")
      }
    } catch (e) {
      console.error("Failed to initialize native SQLite:", e)
    }

    if (!this.instance) {
      console.warn(
        "No native database found or initialization failed, falling back to Mock."
      )
      this.instance = new MockDatabaseService()
    }

    return this.instance
  }
}

export const getDatabase = () => DatabaseServiceFactory.getInstance()
