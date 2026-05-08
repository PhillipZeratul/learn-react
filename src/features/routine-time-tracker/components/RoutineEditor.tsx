import { useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { RoutineCard } from '../models/routine-card.model';
import { timeToISO, isoToTime, formatLocalDate } from '../utils/utils';
import { useTagStore } from '../stores/tag.store';
import type { RoutineCardId, TagId } from '../models/routine-time-tracker.model';
import type { IsoDateTime } from '@/shared/models/base.model';
import { Button } from '@/components/ui/Button';

interface RoutineEditorProps {
    task: RoutineCard;
    masterTask?: RoutineCard;
    onSave: (task: RoutineCard) => Promise<void>;
    onDelete: (id: string) => Promise<void>;
    onCancel: () => void;
}

const RRULE_OPTIONS = [
    { label: 'None', value: '' },
    { label: 'Daily', value: 'FREQ=DAILY;INTERVAL=1' },
    { label: 'Weekly', value: 'FREQ=WEEKLY;INTERVAL=1' },
    { label: 'Every 2 Weeks', value: 'FREQ=WEEKLY;INTERVAL=2' },
    { label: 'Monthly', value: 'FREQ=MONTHLY;INTERVAL=1' },
];

export const RoutineEditor = ({
    task,
    masterTask,
    onSave,
    onDelete,
    onCancel
}: RoutineEditorProps) => {
    const { items: tags } = useTagStore();
    const [title, setTitle] = useState(task.title);
    const [startAt, setStartAt] = useState(isoToTime(task.start_at));
    const [endAt, setEndAt] = useState(isoToTime(task.end_at));
    const [tagId, setTagId] = useState(task.tag_id);
    const [rrule, setRrule] = useState(task.rrule || masterTask?.rrule || '');

    const [confirmAction, setConfirmAction] = useState<'save' | 'delete' | null>(null);

    const activeTags = tags.filter(tag => !tag.is_deleted);

    const isRecurring = !!masterTask || !!task.rrule;

    const handleSave = async (scope: 'one' | 'all' = 'one') => {
        let finalTitle = title.trim();
        if (!finalTitle) {
            const selectedTag = tags.find(t => t.id === tagId);
            finalTitle = selectedTag?.name || 'Routine';
        }

        if (scope === 'all' && masterTask) {
            // Apply changes to the master record
            const masterDatePart = formatLocalDate(new Date(masterTask.start_at));
            const newMasterStartAt = timeToISO(startAt, masterDatePart);
            const newMasterEndAt = timeToISO(endAt, masterDatePart);

            await onSave({
                ...masterTask,
                title: finalTitle,
                start_at: newMasterStartAt,
                end_at: newMasterEndAt,
                tag_id: tagId as TagId,
                rrule: rrule || undefined,
                updated_at: new Date().toISOString() as IsoDateTime
            });
            return;
        }

        // Default: Scope 'one' (Exception logic)
        const datePart = formatLocalDate(new Date(task.start_at));
        const newStartAt = timeToISO(startAt, datePart);
        const newEndAt = timeToISO(endAt, datePart);

        if (task._isVirtual) {
            const masterId = task.id.split('_')[0] as RoutineCardId;
            const detachedInstance: RoutineCard = {
                ...task,
                id: uuidv4() as RoutineCardId,
                parent_routine_id: masterId,
                original_recurrence_date: task.start_at as IsoDateTime,
                title: finalTitle,
                start_at: newStartAt,
                end_at: newEndAt,
                tag_id: tagId as TagId,
                rrule: undefined,
                _isVirtual: undefined,
                updated_at: new Date().toISOString() as IsoDateTime
            };
            await onSave(detachedInstance);
        } else {
            await onSave({ 
                ...task,
                title: finalTitle, 
                start_at: newStartAt, 
                end_at: newEndAt,
                tag_id: tagId as TagId,
                rrule: rrule || undefined,
                updated_at: new Date().toISOString() as IsoDateTime
            });
        }
    };

    const handleDelete = async (scope: 'one' | 'all' = 'one') => {
        if (scope === 'all' && masterTask) {
            await onDelete(masterTask.id);
            return;
        }

        if (task._isVirtual) {
            const masterId = task.id.split('_')[0] as RoutineCardId;
            const deletedInstance: RoutineCard = {
                ...task,
                id: uuidv4() as RoutineCardId,
                parent_routine_id: masterId,
                original_recurrence_date: task.start_at as IsoDateTime,
                is_deleted: true,
                _isVirtual: undefined,
                updated_at: new Date().toISOString() as IsoDateTime
            };
            await onSave(deletedInstance);
        } else {
            await onDelete(task.id);
        }
    };

    const onInitiateSave = () => {
        if (isRecurring) {
            setConfirmAction('save');
        } else {
            handleSave('one');
        }
    };

    const onInitiateDelete = () => {
        if (isRecurring) {
            setConfirmAction('delete');
        } else {
            handleDelete('one');
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="w-full max-w-sm bg-card border border-border rounded-2xl shadow-2xl p-6 animate-in zoom-in-95 duration-200">
                <h3 className="text-lg font-semibold mb-4 text-foreground">
                    {task._isVirtual ? 'Edit Occurrence' : 'Routine'}
                </h3>
                <div className="space-y-4">
                    <div>
                        <label className="text-xs text-muted-foreground mb-1 block">Title</label>
                        <input
                            type="text"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                            placeholder={tags.find(t => t.id === tagId)?.name || "Routine"}
                            autoFocus
                        />
                    </div>
                    <div className="flex gap-4">
                        <div className="flex-1">
                            <label className="text-xs text-muted-foreground mb-1 block">Start</label>
                            <input
                                type="time"
                                value={startAt}
                                onChange={(e) => setStartAt(e.target.value)}
                                className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                            />
                        </div>
                        <div className="flex-1">
                            <label className="text-xs text-muted-foreground mb-1 block">End</label>
                            <input
                                type="time"
                                value={endAt}
                                onChange={(e) => setEndAt(e.target.value)}
                                className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                            />
                        </div>
                    </div>
                    
                    {(!!task.rrule || !!masterTask?.rrule) && (
                        <div>
                            <label className="text-xs text-muted-foreground mb-1 block">Repeat (Series)</label>
                            <select
                                value={rrule}
                                onChange={(e) => setRrule(e.target.value)}
                                className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                            >
                                {RRULE_OPTIONS.map(opt => (
                                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                                ))}
                            </select>
                        </div>
                    )}

                    <div>
                        <label className="text-xs text-muted-foreground mb-1 block">Tag</label>
                        <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
                            {activeTags.map((tag) => (
                                <button
                                    key={tag.id}
                                    onClick={() => setTagId(tag.id)}
                                    className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-xs transition-all border ${
                                        tagId === tag.id 
                                            ? 'bg-primary/10 border-primary' 
                                            : 'bg-muted border-transparent hover:border-muted-foreground/30'
                                    }`}
                                >
                                    <div 
                                        className="w-2 h-2 rounded-full" 
                                        style={{ backgroundColor: tag.color }} 
                                    />
                                    {tag.name}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
                <div className="mt-8 flex flex-col gap-2">
                    <button onClick={onInitiateSave} className="w-full bg-primary text-primary-foreground font-medium py-2 rounded-lg hover:opacity-90 transition-opacity">Save</button>
                    <div className="flex gap-2">
                        <button onClick={onCancel} className="flex-1 bg-muted text-muted-foreground font-medium py-2 rounded-lg hover:bg-muted/80 transition-colors">Cancel</button>
                        <button onClick={onInitiateDelete} className="px-4 bg-destructive/10 text-destructive font-medium py-2 rounded-lg hover:bg-destructive/20 transition-colors">Delete</button>
                    </div>
                </div>
            </div>

            {confirmAction && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-background/40 backdrop-blur-md animate-in fade-in duration-200">
                    <div className="w-full max-w-[280px] bg-card border border-border rounded-2xl shadow-2xl p-6 animate-in zoom-in-95 duration-200">
                        <h4 className="text-base font-semibold mb-2 text-foreground">
                            {confirmAction === 'save' ? 'Save changes' : 'Delete routine'}
                        </h4>
                        <p className="text-sm text-muted-foreground mb-6">
                            Do you want to apply this to only this occurrence or the entire series?
                        </p>
                        <div className="space-y-2">
                            <Button 
                                className="w-full justify-center" 
                                onClick={() => {
                                    if (confirmAction === 'save') handleSave('one');
                                    else handleDelete('one');
                                    setConfirmAction(null);
                                }}
                            >
                                This occurrence only
                            </Button>
                            <Button 
                                variant="outline"
                                className="w-full justify-center" 
                                onClick={() => {
                                    if (confirmAction === 'save') handleSave('all');
                                    else handleDelete('all');
                                    setConfirmAction(null);
                                }}
                            >
                                All occurrences
                            </Button>
                            <Button 
                                variant="ghost"
                                className="w-full justify-center text-muted-foreground" 
                                onClick={() => setConfirmAction(null)}
                            >
                                Cancel
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
