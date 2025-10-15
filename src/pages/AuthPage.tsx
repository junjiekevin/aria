import { useEffect, useState } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { Auth as SupabaseAuth, ThemeSupa } from "@supabase/auth-ui-react";
import { supabase } from "../lib/supabase";

export default function AuthPage() {
    const navigate = useNavigate();
    const [checking, setChecking] = useState(true);
    const [isAuthed, setIsAuthed] = useState(false);

    useEffect(() => {
        let isMounted = true;

        (async () => {
            const {
                data: { session },
            } = await supabase.auth.getSession();

            if (!isMounted) return;

            if (session) {
                setIsAuthed(true);
                setChecking(false);
                return
            }

            const {
                data: { subscription },
            } = supabase.auth.onAuthStateChange((_event, newSession) => {
                if (newSession) {
                    setIsAuthed(true);
                    setTimeout(() => navigate("/dashboard"), 50);
                }
            });

            setChecking(false);
            
            return() => {
                subscription.unsubscribe();
            };
        })();

        return () => {
            isMounted = false;
        };
    }, [navigate]);

    if (checking) {
        return (
            <div className="min-h-screen grid place-items-center">
                <span className="text-sm text-gray-500">Loading...</span>
            </div>
        );
    }

    if (isAuthed) {
        return <Navigate to="/dashboard" replace />;
    }

    return (
        <div className="min-h-screen grid place-items-center p-4">
            <div className="w-full max-w-md">
                <div className="mb-6 text-center">
                    <h1 className="text-2xl font-semibold">Sign in to Aria</h1>
                    <p className="text-sm text-gray-500">Teacher login via Google</p>
                </div>

                <SupabaseAuth
                    supabaseClient={supabase}
                    appearance={{
                        theme: ThemeSupa,
                        className: {
                            container: "border rounded-xl p-4 shadow-sm",
                            button: "rounded-lg",
                            input: "rounded-lg",
                        },
                        variables: {
                            default: {
                                colors: {
                                    brand: "#111827",
                                    brandAccent: "#4B5563",
                                },
                            },
                        },
                    }}
                    providers={["google"]}
                    onlyThirdPartyProviders
                    socialLayout="vertical"
                    redirectTo={window.location.origin + "/dashboard"}
                />
            </div>
        </div>
    );
}