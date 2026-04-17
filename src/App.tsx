import RoutineTimeTrackerWidget from "@/features/routine-time-tracker/RoutineTimeTrackerWidget"
import { Auth } from "@/features/auth/Components/Auth"
import { useAuthStore } from "@/store/authStore"

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
