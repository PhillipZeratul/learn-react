import { signal, computed } from "@preact/signals-react"
import { BASE_PIXELS_PER_MINUTE } from "../utils/utils"

// Signal for high-frequency zoom updates (1x to 3x)
export const zoomLevelSignal = signal(1)

// Derived signal for easy access to current pixels per minute
export const pixelsPerMinuteSignal = computed(
    () => BASE_PIXELS_PER_MINUTE * zoomLevelSignal.value
)
