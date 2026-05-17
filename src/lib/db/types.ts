export interface QueryResult<T = unknown> {
    rows: T[]
    changes?: number
    lastInsertId?: number
}

export interface IDatabaseService {
    execute(query: string, values?: unknown[]): Promise<QueryResult>
    select<T>(query: string, values?: unknown[]): Promise<T[]>
    transaction<T>(callback: (db: IDatabaseService) => Promise<T>): Promise<T>
}
