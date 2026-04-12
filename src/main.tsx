import { StrictMode, useEffect } from "react"
import { createRoot } from "react-dom/client"
import "@preact/signals-react/runtime";

import "./index.css"
import App from "./App.tsx"
import { ThemeProvider } from "@/components/theme-provider.tsx"
import { RoutineService } from "@/services/routineService"

function Root() {
    useEffect(() => {
        RoutineService.initialize();
    }, []);

    return (
        <StrictMode>
            <ThemeProvider>
                <App />
            </ThemeProvider>
        </StrictMode>
    );
}

createRoot(document.getElementById("root")!).render(<Root />)
