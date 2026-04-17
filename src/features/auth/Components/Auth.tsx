import React, { useState } from 'react';
import { useAuthStore } from '../stores/auth.store';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/Button';

export const Auth = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [isSignUp, setIsSignUp] = useState(false);
    const setError = useAuthStore(state => state.setError);
    const errorMsg = useAuthStore(state => state.error);

    const handleAuth = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!supabase) return;
        setLoading(true);
        setError(null);

        try {
            const { error } = isSignUp 
                ? await supabase.auth.signUp({ email, password })
                : await supabase.auth.signInWithPassword({ email, password });

            if (error) throw error;
            if (isSignUp) {
                alert('Check your email for the confirmation link!');
            }
        } catch (err: any) {
            setError(err.message || String(err));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex flex-col items-center justify-center p-6 bg-card rounded-2xl border border-border shadow-lg max-w-sm w-full">
            <h2 className="text-2xl font-bold mb-6 text-foreground">{isSignUp ? 'Create Account' : 'Sign In'}</h2>
            
            <form onSubmit={handleAuth} className="w-full space-y-4">
                <div className="space-y-2">
                    <label className="text-sm font-medium text-muted-foreground">Email</label>
                    <input 
                        type="email" 
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full p-3 bg-background border border-input rounded-xl focus:ring-2 focus:ring-primary outline-none transition-all"
                        placeholder="your@email.com"
                        required
                    />
                </div>
                
                <div className="space-y-2">
                    <label className="text-sm font-medium text-muted-foreground">Password</label>
                    <input 
                        type="password" 
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full p-3 bg-background border border-input rounded-xl focus:ring-2 focus:ring-primary outline-none transition-all"
                        placeholder="••••••••"
                        required
                    />
                </div>

                {errorMsg && (
                    <div className="p-3 bg-destructive/10 text-destructive text-xs rounded-lg border border-destructive/20">
                        {errorMsg}
                    </div>
                )}

                <Button 
                    type="submit" 
                    className="w-full py-6 rounded-xl font-bold text-lg" 
                    disabled={loading}
                >
                    {loading ? 'Processing...' : (isSignUp ? 'Sign Up' : 'Sign In')}
                </Button>
            </form>

            <button 
                onClick={() => setIsSignUp(!isSignUp)}
                className="mt-6 text-sm text-primary hover:underline font-medium"
            >
                {isSignUp ? 'Already have an account? Sign In' : "Don't have an account? Sign Up"}
            </button>
        </div>
    );
};
