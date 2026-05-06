import { useState } from 'react';
import type { TimeTrackerCard } from '../models/time-tracker-card.model';
import { timeToISO, isoToTime } from '../utils/utils';
import { useTagStore } from '../stores/tag.store';
import { DEFAULT_TAG_ID } from '../models/tag.model';

interface TimeTrackerEditorProps {
    task: TimeTrackerCard;
    onSave: (task: TimeTrackerCard) => Promise<void>;
    onDelete: (id: string) => Promise<void>;
    onCancel: () => void;
}

export const TimeTrackerEditor = ({
    task,
    onSave,
    onDelete,
    onCancel
}: TimeTrackerEditorProps) => {
    const { items: tags } = useTagStore();
    const [title, setTitle] = useState(task.title);
    const [startAt, setStartAt] = useState(isoToTime(task.start_at));
    const [endAt, setEndAt] = useState(isoToTime(task.end_at));
    const [tagId, setTagId] = useState(task.tag_id);

    const activeTags = tags.filter(tag => !tag.is_deleted);

    const handleSave = async () => {
        let finalTitle = title.trim();
        if (!finalTitle) {
            const selectedTag = tags.find(t => t.id === tagId);
            finalTitle = selectedTag?.name || 'Time Tracker';
        }

        await onSave({ 
            ...task,
            title: finalTitle, 
            start_at: timeToISO(startAt), 
            end_at: timeToISO(endAt),
            tag_id: tagId || DEFAULT_TAG_ID
        });
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="w-full max-w-sm bg-card border border-border rounded-2xl shadow-2xl p-6 animate-in zoom-in-95 duration-200">
                <h3 className="text-lg font-semibold mb-4 text-foreground">Time Tracker</h3>
                <div className="space-y-4">
                    <div>
                        <label className="text-xs text-muted-foreground mb-1 block">Title</label>
                        <input
                            type="text"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                            placeholder={tags.find(t => t.id === tagId)?.name || "Time Tracker"}
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
                    <button onClick={handleSave} className="w-full bg-primary text-primary-foreground font-medium py-2 rounded-lg hover:opacity-90 transition-opacity">Save</button>
                    <div className="flex gap-2">
                        <button onClick={onCancel} className="flex-1 bg-muted text-muted-foreground font-medium py-2 rounded-lg hover:bg-muted/80 transition-colors">Cancel</button>
                        <button onClick={() => onDelete(task.id)} className="px-4 bg-destructive/10 text-destructive font-medium py-2 rounded-lg hover:bg-destructive/20 transition-colors">Delete</button>
                    </div>
                </div>
            </div>
        </div>
    );
};
