import { useEffect, useRef, useLayoutEffect } from "react"
import { backActionManager } from "../lib/back-action"

/**
 * Hook to register a "back" action handler.
 * The handler will be called when the platform back button/gesture/key is triggered.
 *
 * @param handler The function to call when "back" is triggered.
 * @param active Whether the handler should be active. Usually depends on whether a modal/editor is open.
 */
export function useBackAction(handler: () => void, active: boolean) {
    const handlerRef = useRef(handler)

    useLayoutEffect(() => {
        handlerRef.current = handler
    })

    useEffect(() => {
        if (active) {
            const stableHandler = () => handlerRef.current()
            return backActionManager.register(stableHandler)
        }
    }, [active])
}
