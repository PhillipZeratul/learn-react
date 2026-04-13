import { v4 as uuidv4 } from 'uuid';
import type { RoutineCardId, TagId } from '../types/models';
import type {UserId, BaseEntity, IsoDateTime} from '@/types/models'
import {TEST_USER_ID, TEST_TAG_ID} from "@/test/test_consts";

export class RoutineCard implements BaseEntity {
    id: RoutineCardId;
    title: string;
    description?: string;
    start_at: IsoDateTime;
    end_at: IsoDateTime;
    tag_id: TagId;
    user_id: UserId;
    
    created_at: string;
    updated_at: string;
    is_deleted: boolean;

    constructor(
        data: Partial<RoutineCard> & {
            start_at: string;
            end_at: string;
        }
    ) {
        const now = new Date().toISOString();
        
        this.id = data.id || uuidv4() as RoutineCardId;
        this.title = data.title || "New Routine Card";
        this.description = data.description || "New Routine Card Description.";
        this.start_at = data.start_at;
        this.end_at = data.end_at;
        this.tag_id = data.tag_id || TEST_TAG_ID; // TODO: Why can this pass compilation?
        this.user_id = data.user_id || TEST_USER_ID;
        
        this.created_at = now;
        this.updated_at = now;
        this.is_deleted = false;
    }
}
