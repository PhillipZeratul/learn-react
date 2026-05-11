import "@testing-library/jest-dom"
import { cleanup } from "@testing-library/react"
import { afterEach, vi } from "vitest"

// 1. Automatically unmount React components after every test
afterEach(() => {
    cleanup()
})

// 2. Clear all mocks after every test to prevent state bleeding
afterEach(() => {
    vi.clearAllMocks()
})

// Note: If you have a unified `resetAllStores()` function for Zustand,
// you should call it here inside an `afterEach` block.
