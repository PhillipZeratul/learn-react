import { v4 as uuidv4 } from 'uuid';
import type { TimeTrackerCardId, TagId } from '../types/models';
import type { UserId, BaseEntity } from '@/types/models'
import {TEST_USER_ID, TEST_TAG_ID} from "@/test/test_consts";

export class TimeTrackerCard implements BaseEntity {
    id: TimeTrackerCardId;
    user_id: UserId;
    title: string;
    description?: string;
    start_at: string;
    end_at: string;
    tag: TagId;
    
    created_at: string;
    updated_at: string;
    is_deleted: boolean;

    constructor(
        data: Partial<TimeTrackerCard> & {
            start_at: string;
            end_at: string;
        }
    ) {
        const now = new Date().toISOString();
        
        this.id = data.id || uuidv4() as TimeTrackerCardId;
        this.title = data.title || "New TimeTracker Card";
        this.description = data.description || "New TimeTracker Card Description.";
        this.start_at = data.start_at;
        this.end_at = data.end_at;
        this.tag = data.title || TEST_TAG_ID;
        this.user_id = data.user_id || TEST_USER_ID;
        
        this.created_at = now;
        this.updated_at = now;
        this.is_deleted = false;
    }
}
