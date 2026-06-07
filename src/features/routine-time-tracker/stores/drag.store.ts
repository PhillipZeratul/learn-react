import { signal } from "@preact/signals-react"

export interface DragOverride {
    top: number
    height: number
}

// Global registry mapping cardId -> override style offsets during active dragging
export const dragOverridesSignal = signal<Record<string, DragOverride>>({})

// Signals for high-frequency dragging updates
export const dragTopSignal = signal(0)
export const dragHeightSignal = signal(0)
export const dragLeftSignal = signal(0)
export const isHoveringTrackerColumnSignal = signal(false)
