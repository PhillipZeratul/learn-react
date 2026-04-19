import type {Brand, BaseEntity} from "@/models/base.model";

export type RoutineCardId = Brand<string, 'TaskId'>;
export type TimeTrackerCardId = Brand<string, 'TimeTrackerBlockId'>;
export type TagId = Brand<string, 'TagId'>;

export interface ModelConfig<T extends BaseEntity> {
    tableName: string;
    createTableSql: string;
    saveSql: string;
    toSqlValues: (model: T) => any[];
    fromDb: (row: any) => T;
    updateStore: (items: T[]) => void;
    findInStore: (id: string) => T | undefined;
    addToStore: (item: T) => void;
    updateInStore: (id: string, item: T) => void;
    deleteFromStore: (id: string) => void;
}