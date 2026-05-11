import type { IDatabaseService, QueryResult } from "./types"

export class CapacitorDatabaseService implements IDatabaseService {
  private db: any

  constructor(db: any) {
    this.db = db
  }
  async execute(query: string, values?: any[]): Promise<QueryResult> {
    const result = await this.db.run(query, values)
    return {
      rows: [],
      changes: result.changes?.changes,
      lastInsertId: result.changes?.lastId,
    }
  }
  async select<T>(query: string, values?: any[]): Promise<T[]> {
    const result = await this.db.query(query, values)
    return result.values || []
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
  return new CapacitorDatabaseService(db)
}
