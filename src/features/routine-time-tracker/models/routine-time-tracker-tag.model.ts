import { v4 as uuidv4 } from 'uuid';
import type { TagId } from './routine-time-tracker.model';
import type { UserId, BaseEntity, IsoDateTime } from '@/models/base.model';
import { useAuthStore } from '@/features/auth/stores/auth.store';

export class RoutineTimeTrackerTag implements BaseEntity {
    id: TagId;
    user_id: UserId;
    name: string;
    color: string;

    created_at: IsoDateTime;
    updated_at: IsoDateTime;
    is_deleted: boolean;

    constructor(
        data: Partial<RoutineTimeTrackerTag>
    ) {
        const now = new Date().toISOString() as IsoDateTime;
        const currentUserId = useAuthStore.getState().user?.id as UserId;

        this.id = data.id || uuidv4() as TagId;
        this.name = data.name || "New Tag";
        this.color = data.color || "#000000";
        this.user_id = data.user_id || currentUserId;

        this.created_at = data.created_at || now;
        this.updated_at = data.updated_at || now;
        this.is_deleted = data.is_deleted || false;
    }
}
