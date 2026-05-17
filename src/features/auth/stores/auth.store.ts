import { create } from "zustand"
import { persist } from "zustand/middleware"
import type { User, Session } from "@supabase/supabase-js"

interface AuthState {
    user: User | null
    session: Session | null
    isSyncing: boolean
    error: string | null
    setAuth: (user: User | null, session: Session | null) => void
    setUser: (user: User | null) => void
    setSession: (session: Session | null) => void

    setSyncing: (syncing: boolean) => void
    setError: (error: string | null) => void
    signOut: () => void
}

export const useAuthStore = create<AuthState>()(
    persist(
        (set) => ({
            user: null,
            session: null,
            isSyncing: true,
            error: null,
            setAuth: (user, session) => set({ user, session }),
            setUser: (user) => set({ user }),
            setSession: (session) => set({ session }),
            setSyncing: (isSyncing) => set({ isSyncing }),
            setError: (error) => set({ error }),
            signOut: () => set({ user: null, session: null, error: null }),
        }),
        {
            name: "auth-storage",
            partialize: (state) => ({
                user: state.user,
                session: state.session,
            }),
        }
    )
)
