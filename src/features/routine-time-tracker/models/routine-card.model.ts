import { v4 as uuidv4 } from 'uuid';
import type { RoutineCardId, TagId } from './routine-time-tracker.model';
import type { UserId, BaseEntity, IsoDateTime} from '@/models/base.model'
import {TEST_TAG_ID} from "@/test/test-consts";
import { useAuthStore } from '@/features/auth/stores/auth.store';

export class RoutineCard implements BaseEntity {
    id: RoutineCardId;
    user_id: UserId;
    title: string;
    description?: string;
    start_at: IsoDateTime;
    end_at: IsoDateTime;
    tag_id: TagId;
    
    created_at: IsoDateTime;
    updated_at: IsoDateTime;
    is_deleted: boolean;

    constructor(
        data: Partial<RoutineCard>
    ) {
        const now = new Date().toISOString() as IsoDateTime;
        const currentUserId = useAuthStore.getState().user?.id as UserId;

        this.id = data.id || uuidv4() as RoutineCardId;
        this.title = data.title || "New Routine Card";
        this.description = data.description || "New Routine Card Description.";
        this.start_at = data.start_at || now;
        this.end_at = data.end_at || now;
        this.tag_id = data.tag_id || TEST_TAG_ID;
        this.user_id = data.user_id || currentUserId;

        this.created_at = data.created_at || now;
        this.updated_at = data.updated_at || now;
        this.is_deleted = data.is_deleted || false;
    }
}

