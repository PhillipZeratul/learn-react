import { v4 as uuidv4 } from 'uuid';
import type { TagId } from './routine-time-tracker.model';
import type { UserId, BaseEntity, IsoDateTime } from '@/models/base.model';
import { useAuthStore } from '@/features/auth/stores/auth.store';

export interface RoutineTimeTrackerTag extends BaseEntity {
    __type: 'RoutineTimeTrackerTag';
    id: TagId;
    user_id: UserId;
    name: string;
    color: string;
}

export const isRoutineTimeTrackerTag = (tag: any): tag is RoutineTimeTrackerTag => {
    return tag && tag.__type === 'RoutineTimeTrackerTag';
};

export const createRoutineTimeTrackerTag = (data: Partial<RoutineTimeTrackerTag> = {}): RoutineTimeTrackerTag => {
    const now = new Date().toISOString() as IsoDateTime;
    const currentUserId = useAuthStore.getState().user?.id as UserId;

    return {
        __type: 'RoutineTimeTrackerTag',
        id: data.id || uuidv4() as TagId,
        name: data.name || "New Tag",
        color: data.color || "#787878",
        user_id: data.user_id || currentUserId,
        created_at: data.created_at || now,
        updated_at: data.updated_at || now,
        is_deleted: data.is_deleted || false,
    };
};
