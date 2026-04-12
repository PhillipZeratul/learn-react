import { getDatabase } from '@/lib/db/sqlite'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'

export class SyncService {
    private static isSyncing = false;

    static async startBackgroundSync(intervalMs: number = 30000) {
        if (!isSupabaseConfigured) {
            console.warn("SyncService: Supabase not configured, skipping background sync.");
            return;
        }

        setInterval(async () => {
            if (this.isSyncing) return;
            await this.sync();
        }, intervalMs);
    }

    static async sync() {
        if (!isSupabaseConfigured || !supabase || this.isSyncing) return;
        this.isSyncing = true;

        try {
            const db = await getDatabase();
            const queue = await db.select<any>('SELECT * FROM sync_queue ORDER BY created_at ASC');

            for (const item of queue) {
                const payload = JSON.parse(item.payload);
                let success = false;

                try {
                    const { error } = await supabase
                        .from(item.table_name)
                        .upsert(payload);
                    
                    if (!error) {
                        success = true;
                    } else {
                        console.error(`Supabase sync error for ${item.table_name}:`, error);
                    }
                } catch (e) {
                    console.error("Network error during sync:", e);
                }

                if (success) {
                    await db.execute('DELETE FROM sync_queue WHERE id = ?', [item.id]);
                } else {
                    break; // Maintain order, try again next interval
                }
            }
        } catch (err) {
            console.error("Sync loop failed:", err);
        } finally {
            this.isSyncing = false;
        }
    }
}
