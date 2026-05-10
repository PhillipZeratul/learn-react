import React from 'react';
import { Button } from '@/components/ui/Button';

interface SaveChangeDialogProps {
    onOccurrenceOnly: () => void;
    onAllOccurrences: () => void;
    onCancel: () => void;
}

export const SaveChangeDialog = ({ onOccurrenceOnly, onAllOccurrences, onCancel }: SaveChangeDialogProps) => {
    return (
        <div 
            className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-background/20 backdrop-blur-[4px] animate-in fade-in duration-200"
        >
            <div className="w-full max-w-[280px] bg-card border border-border rounded-2xl shadow-2xl p-6 animate-in zoom-in-95 duration-200">
                <h4 className="text-base font-semibold mb-2 text-foreground">Save changes</h4>
                <p className="text-sm text-muted-foreground mb-6">
                    Do you want to apply this change to only this occurrence or the entire series?
                </p>
                <div className="space-y-2">
                    <Button 
                        className="w-full justify-center" 
                        onClick={onOccurrenceOnly}
                    >
                        This occurrence only
                    </Button>
                    <Button 
                        variant="outline"
                        className="w-full justify-center" 
                        onClick={onAllOccurrences}
                    >
                        All occurrences
                    </Button>
                    <Button 
                        variant="ghost"
                        className="w-full justify-center text-muted-foreground" 
                        onClick={onCancel}
                    >
                        Cancel
                    </Button>
                </div>
            </div>
        </div>
    );
};
