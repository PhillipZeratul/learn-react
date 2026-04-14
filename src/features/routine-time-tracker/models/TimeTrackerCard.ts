import { v4 as uuidv4 } from 'uuid';
import type { TimeTrackerCardId, TagId } from '../types/models';
import type { UserId, BaseEntity, IsoDateTime} from '@/types/models'
import {TEST_TAG_ID} from "@/test/test_consts";
import { useAuthStore } from '@/store/authStore';

export class TimeTrackerCard implements BaseEntity {
    id: TimeTrackerCardId;
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
        data: Partial<TimeTrackerCard>
    ) {
        const now = new Date().toISOString() as IsoDateTime;
        const currentUserId = useAuthStore.getState().user?.id as UserId;
        
        this.id = data.id || uuidv4() as TimeTrackerCardId;
        this.title = data.title || "New TimeTracker Card";
        this.description = data.description || "New TimeTracker Card Description.";
        this.start_at = data.start_at || now;
        this.end_at = data.end_at || now;
        this.tag_id = data.tag_id || TEST_TAG_ID;
        this.user_id = data.user_id || currentUserId;
        
        this.created_at = data.created_at || now;
        this.updated_at = data.updated_at || now;
        this.is_deleted = data.is_deleted || false;
    }
}
