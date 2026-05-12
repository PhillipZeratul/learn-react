import React from "react"
import { Button } from "@/components/ui/Button"

interface SaveChangeDialogProps {
    onOccurrenceOnly: () => void
    onAllOccurrences: () => void
    onCancel: () => void
}

export const SaveChangeDialog = ({
    onOccurrenceOnly,
    onAllOccurrences,
    onCancel,
}: SaveChangeDialogProps) => {
    return (
        <div className="fixed inset-0 z-[60] flex animate-in items-center justify-center bg-background/20 p-4 backdrop-blur-[4px] duration-200 fade-in">
            <div className="w-full max-w-[280px] animate-in rounded-2xl border border-border bg-card p-6 shadow-2xl duration-200 zoom-in-95">
                <h4 className="mb-2 text-base font-semibold text-foreground">
                    Save changes
                </h4>
                <p className="mb-6 text-sm text-muted-foreground">
                    Do you want to apply this change to only this occurrence or
                    the entire series?
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
    )
}
