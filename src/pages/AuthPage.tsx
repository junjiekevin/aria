import { useEffect, useState } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { Auth as SupabaseAuth, ThemeSupa } from "@supabase/auth-ui-react";
import { supabase } from "../lib/supabase";

const styles = {
    container: {
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        padding: '1rem',
        background: 'linear-gradient(135deg, #fff7ed 0%, #ffffff 50%, #fff7ed 100%)',
    },
    card: {
        width: '100%',
        maxWidth: '28rem',
        backgroundColor: 'white',
        borderRadius: '0.75rem',
        padding: '2rem',
        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
        border: '1px solid #e5e7eb',
    },
    header: {
        marginBottom: '1.5rem',
        textAlign: 'center' as const,
    },
    title: {
        fontSize: '1.5rem',
        fontWeight: '600',
        margin: '0 0 0.5rem 0',
        color: '#111827',
    },
    loading: {
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        fontSize: '0.875rem',
        color: '#6b7280',
    },
};

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
            <div style={styles.loading}>
                <span>Loading...</span>
            </div>
        );
    }

    if (isAuthed) {
        return <Navigate to="/dashboard" replace />;
    }

    return (
        <div style={styles.container}>
            <div style={styles.card}>
                <div style={styles.header}>
                    <h1 style={styles.title}>Your personal scheduling assistant</h1>
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
                                    brand: "#f97316",
                                    brandAccent: "#ea580c",
                                },
                            },
                        },
                    }}
                    providers={["google"]}
                    onlyThirdPartyProviders
                    socialLayout="vertical"
                    redirectTo={window.location.origin + "/dashboard"}
                    localization={{
                        variables: {
                            sign_in: {
                                button_label: "Sign in",
                            },
                        },
                    }}
                />
            </div>
        </div>
    );
}