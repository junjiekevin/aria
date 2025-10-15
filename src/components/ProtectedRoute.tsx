import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "../lib/supabase";

interface ProtectedRouteProps {
    children: ReactNode;
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
    const [session, setSession] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let isMounted = true;

        // Fetch current session
        supabase.auth.getSession().then(({ data }) => {
            if (!isMounted) return;
            setSession(data.session);
            setLoading(false);
        });

        // Listen for auth state changes (login/logout)
        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange((_event, newSession) => {
            setSession(newSession);
        });

        return () => {
            isMounted = false;
            subscription.unsubscribe();
        };
    }, []);

    // While checking
    if (loading) {
        return (
            <div className="min-h-screen grid place-items-center">
                <span className="text-sm text-gray-500">Checking authentication…</span>
            </div>
        );
    }

    // If not logged in
    if (!session) {
        return <Navigate to="/auth" replace />;
    }

    // Else render protected content
    return children;
}