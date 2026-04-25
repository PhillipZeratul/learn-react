import type {Brand} from "@/shared/models/base.model";

export type RoutineCardId = Brand<string, 'TaskId'>;
export type TimeTrackerCardId = Brand<string, 'TimeTrackerBlockId'>;
export type TagId = Brand<string, 'TagId'>;