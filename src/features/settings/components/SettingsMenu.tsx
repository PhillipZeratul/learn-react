import { TagManager } from './TagManager';
import { Button } from '@/components/ui/Button';
import { HugeiconsIcon } from '@hugeicons/react';
import { Cancel01Icon } from '@hugeicons/core-free-icons';

interface SettingsMenuProps {
    onClose: () => void;
}

export const SettingsMenu = ({ onClose }: SettingsMenuProps) => {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="w-full max-w-md bg-card border border-border rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
                <div className="p-4 border-b flex items-center justify-between bg-muted/30">
                    <h2 className="text-xl font-semibold text-foreground font-heading">Settings</h2>
                    <Button variant="ghost" size="icon" onClick={onClose}>
                        <HugeiconsIcon icon={Cancel01Icon} size={20} />
                    </Button>
                </div>
                
                <div className="p-6 overflow-y-auto">
                    <TagManager />
                </div>

                <div className="p-4 border-t bg-muted/30 flex justify-end">
                    <Button onClick={onClose}>
                        Done
                    </Button>
                </div>
            </div>
        </div>
    );
};
