import { signal } from '@preact/signals-react';

// Signals for high-frequency dragging updates
export const dragTopSignal = signal(0);
export const dragHeightSignal = signal(0);
