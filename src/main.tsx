if (import.meta.env.DEV) {
    await import("react-grab")
}

import { createRoot } from "react-dom/client"
import "@preact/signals-react/runtime"
import "./index.css"
import { Root } from "./Root"

createRoot(document.getElementById("root")!).render(<Root />)
