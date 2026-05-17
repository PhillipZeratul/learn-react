import React, { useState } from "react"
import { useAuthStore } from "../stores/auth.store"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/Button"

export const Auth = () => {
    const [email, setEmail] = useState("")
    const [password, setPassword] = useState("")
    const [loading, setLoading] = useState(false)
    const [isSignUp, setIsSignUp] = useState(false)
    const setError = useAuthStore((state) => state.setError)
    const errorMsg = useAuthStore((state) => state.error)

    const handleAuth = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!supabase) return
        setLoading(true)
        setError(null)

        try {
            const { error } = isSignUp
                ? await supabase.auth.signUp({ email, password })
                : await supabase.auth.signInWithPassword({ email, password })

            if (error) throw error
            if (isSignUp) {
                alert("Check your email for the confirmation link!")
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err))
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="flex w-full max-w-sm flex-col items-center justify-center rounded-2xl border border-border bg-card p-6 shadow-lg">
            <h2 className="mb-6 text-2xl font-semibold text-foreground">
                {isSignUp ? "Create Account" : "Sign In"}
            </h2>

            <form onSubmit={handleAuth} className="w-full space-y-4">
                <div className="space-y-2">
                    <label
                        htmlFor="auth-email"
                        className="text-sm font-medium text-muted-foreground"
                    >
                        Email
                    </label>
                    <input
                        id="auth-email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full rounded-xl border border-input bg-background p-3 transition-all outline-none focus:ring-2 focus:ring-primary"
                        placeholder="your@email.com"
                        required
                    />
                </div>

                <div className="space-y-2">
                    <label
                        htmlFor="auth-password"
                        className="text-sm font-medium text-muted-foreground"
                    >
                        Password
                    </label>
                    <input
                        id="auth-password"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full rounded-xl border border-input bg-background p-3 transition-all outline-none focus:ring-2 focus:ring-primary"
                        placeholder="••••••••"
                        required
                    />
                </div>

                {errorMsg && (
                    <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-xs text-destructive">
                        {errorMsg}
                    </div>
                )}

                <Button
                    type="submit"
                    className="w-full rounded-xl py-6 text-lg font-semibold"
                    disabled={loading}
                >
                    {loading
                        ? "Processing..."
                        : isSignUp
                          ? "Sign Up"
                          : "Sign In"}
                </Button>
            </form>

            <button
                onClick={() => setIsSignUp(!isSignUp)}
                className="mt-6 text-sm font-medium text-primary hover:underline"
            >
                {isSignUp
                    ? "Already have an account? Sign In"
                    : "Don't have an account? Sign Up"}
            </button>
        </div>
    )
}
