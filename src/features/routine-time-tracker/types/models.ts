import type {Brand} from "@/models/models";

export type RoutineCardId = Brand<string, 'TaskId'>;
export type TimeTrackerCardId = Brand<string, 'TimeTrackerBlockId'>;
export type TagId = Brand<string, 'TagId'>;