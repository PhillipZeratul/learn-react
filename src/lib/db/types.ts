export interface QueryResult<T = any> {
  rows: T[]
  changes?: number
  lastInsertId?: number
}

export interface IDatabaseService {
  execute(query: string, values?: any[]): Promise<QueryResult>
  select<T>(query: string, values?: any[]): Promise<T[]>
  transaction<T>(callback: (db: IDatabaseService) => Promise<T>): Promise<T>
}
