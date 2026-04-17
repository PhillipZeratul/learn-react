import RoutineTimeTrackerWidget from "@/features/routine-time-tracker/components/RoutineTimeTrackerWidget"
import { Auth } from "@/features/auth/components/Auth"
import { useAuthStore } from "@/features/auth/stores/auth.store"

export function App() {
    const user = useAuthStore(state => state.user);

    if (!user) {
        return (
            <div className="h-svh w-full flex items-center justify-center bg-background p-4">
                <Auth />
            </div>
        );
    }

    return (
        <div className="h-svh w-full overflow-hidden flex justify-center">
            <RoutineTimeTrackerWidget/>
        </div>
    )
}

export default App
