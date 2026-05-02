import { useState } from 'react';
import { useTagStore } from '@/features/routine-time-tracker/stores/tag.store';
import { createTag, tagConfig } from '@/features/routine-time-tracker/models/tag.model';
import { Button } from '@/components/ui/button';
import { HugeiconsIcon } from '@hugeicons/react';
import { PlusSignIcon, Delete02Icon } from '@hugeicons/core-free-icons';
import { SyncService } from '@/shared/services/sync.service';

export const TagManager = () => {
    const { items: tags, add: addTag, remove: deleteTag } = useTagStore();
    const [newTagName, setNewTagName] = useState('');
    const [newTagColor, setNewTagColor] = useState('#787878');

    const handleAddTag = async () => {
        if (!newTagName.trim()) return;
        const tag = createTag({
            name: newTagName,
            color: newTagColor,
        });
        addTag(tag);
        await SyncService.save(tagConfig, tag);
        setNewTagName('');
    };

    const handleDeleteTag = async (id: string) => {
        deleteTag(id);
        await SyncService.delete(tagConfig, id);
    };

    const activeTags = tags.filter(tag => !tag.is_deleted);

    return (
        <div className="space-y-6">
            <div className="space-y-4">
                <h3 className="text-lg font-medium">Manage Tags</h3>
                <div className="flex gap-2">
                    <input
                        type="text"
                        value={newTagName}
                        onChange={(e) => setNewTagName(e.target.value)}
                        placeholder="Tag name..."
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    />
                    <input
                        type="color"
                        value={newTagColor}
                        onChange={(e) => setNewTagColor(e.target.value)}
                        className="h-10 w-12 rounded-md border border-input bg-background p-1 cursor-pointer"
                    />
                    <Button onClick={handleAddTag} size="icon">
                        <HugeiconsIcon icon={PlusSignIcon} size={18} />
                    </Button>
                </div>
            </div>

            <div className="space-y-2">
                {activeTags.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No tags yet.</p>
                ) : (
                    activeTags.map((tag) => (
                        <div key={tag.id} className="flex items-center justify-between p-2 rounded-lg border bg-card">
                            <div className="flex items-center gap-3">
                                <div 
                                    className="w-4 h-4 rounded-full" 
                                    style={{ backgroundColor: tag.color }} 
                                />
                                <span className="text-sm font-medium">{tag.name}</span>
                            </div>
                            <Button 
                                variant="ghost" 
                                size="icon" 
                                onClick={() => handleDeleteTag(tag.id)}
                                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                            >
                                <HugeiconsIcon icon={Delete02Icon} size={18} />
                            </Button>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};
