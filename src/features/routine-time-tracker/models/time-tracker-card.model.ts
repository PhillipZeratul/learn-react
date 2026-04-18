import { v4 as uuidv4 } from 'uuid';
import type { TimeTrackerCardId, TagId } from './routine-time-tracker.model';
import type { UserId, BaseEntity, IsoDateTime} from '@/models/base.model'
import {TEST_TAG_ID} from "@/test/test-consts";
import { useAuthStore } from '@/features/auth/stores/auth.store';

export interface TimeTrackerCard extends BaseEntity {
    id: TimeTrackerCardId;
    title: string;
    description?: string;
    start_at: IsoDateTime;
    end_at: IsoDateTime;
    tag_id: TagId;
}

export const createTimeTrackerCard = (data: Partial<TimeTrackerCard> = {}): TimeTrackerCard => {
    const now = new Date().toISOString() as IsoDateTime;
    const currentUserId = useAuthStore.getState().user?.id as UserId;

    return {
        id: data.id || uuidv4() as TimeTrackerCardId,
        title: data.title || "New TimeTracker Card",
        description: data.description || "New TimeTracker Card Description.",
        start_at: data.start_at || now,
        end_at: data.end_at || now,
        tag_id: data.tag_id || TEST_TAG_ID,
        user_id: data.user_id || currentUserId,
        created_at: data.created_at || now,
        updated_at: data.updated_at || now,
        is_deleted: data.is_deleted || false,
    };
};
