import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { User } from '@supabase/supabase-js'

interface AuthState {
    user: User | null
    session: any | null
    isLoading: boolean
    error: string | null
    setUser: (user: User | null) => void
    setSession: (session: any | null) => void
    setLoading: (isLoading: boolean) => void
    setError: (error: string | null) => void
    signOut: () => void
}

export const useAuthStore = create<AuthState>()(
    persist(
        (set) => ({
            user: null,
            session: null,
            isLoading: true,
            error: null,

            setUser: (user) => set({ user }),
            setSession: (session) => set({ session }),
            setLoading: (isLoading) => set({ isLoading }),
            setError: (error) => set({ error }),
            signOut: () => set({ user: null, session: null, error: null }),
        }),
        {
            name: 'auth-storage',
            partialize: (state) => ({ user: state.user, session: state.session }),
        }
    )
)
