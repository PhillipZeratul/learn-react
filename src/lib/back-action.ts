import { App } from "@capacitor/app"

type BackHandler = () => void

class BackActionManager {
    private handlers: BackHandler[] = []

    constructor() {
        if (typeof window !== "undefined") {
            window.addEventListener("keydown", this.handleKeyDown)
        }

        // Handle Capacitor back button (Mobile gestures / Hardware button)
        App.addListener("backButton", ({ canGoBack }) => {
            if (this.handlers.length > 0) {
                this.triggerLastHandler()
            } else if (!canGoBack) {
                App.exitApp()
            }
        }).catch(console.error)
    }

    private triggerLastHandler = () => {
        const handler = this.handlers[this.handlers.length - 1]
        if (handler) {
            handler()
        }
    }

    private handleKeyDown = (event: KeyboardEvent) => {
        if (event.key === "Escape") {
            if (this.handlers.length > 0) {
                event.preventDefault()
                this.triggerLastHandler()
            }
        }
    }

    register(handler: BackHandler) {
        this.handlers.push(handler)

        return () => {
            const index = this.handlers.indexOf(handler)
            if (index !== -1) {
                this.handlers.splice(index, 1)
            }
        }
    }
}

export const backActionManager = new BackActionManager()
