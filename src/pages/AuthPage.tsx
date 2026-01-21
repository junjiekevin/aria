import { useEffect, useState } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { Auth as SupabaseAuth, ThemeSupa } from "@supabase/auth-ui-react";
import { supabase } from "../lib/supabase";

const styles = {
    container: {
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column' as const,
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem',
        background: 'linear-gradient(180deg, #fff7ed 0%, #ffffff 50%, #fff7ed 100%)',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    },
    logoSection: {
        textAlign: 'center' as const,
        marginBottom: '2.5rem',
    },
    logo: {
        fontSize: '4rem',
        marginBottom: '0.5rem',
    },
    title: {
        fontSize: '2.5rem',
        fontWeight: '700',
        color: '#111827',
        margin: '0 0 0.5rem 0',
        letterSpacing: '-0.02em',
    },
    tagline: {
        fontSize: '1.125rem',
        color: '#6b7280',
        margin: 0,
        maxWidth: '320px',
    },
    card: {
        width: '100%',
        maxWidth: '400px',
        backgroundColor: 'white',
        borderRadius: '1rem',
        padding: '2.5rem',
        boxShadow: '0 10px 40px rgba(0, 0, 0, 0.08), 0 4px 12px rgba(0, 0, 0, 0.04)',
        border: '1px solid #f3f4f6',
    },
    cardTitle: {
        fontSize: '1.25rem',
        fontWeight: '600',
        color: '#111827',
        marginBottom: '1.5rem',
        textAlign: 'center' as const,
    },
    features: {
        display: 'flex',
        flexWrap: 'wrap' as const,
        gap: '0.75rem',
        marginTop: '2rem',
        justifyContent: 'center',
    },
    feature: {
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        fontSize: '0.875rem',
        color: '#6b7280',
    },
    loading: {
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        fontSize: '1rem',
        color: '#6b7280',
    },
    spinner: {
        width: '40px',
        height: '40px',
        border: '3px solid #f3f4f6',
        borderTopColor: '#f97316',
        borderRadius: '50%',
        animation: 'spin 1s linear infinite',
        marginBottom: '1rem',
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
            <div style={styles.container}>
                <style>
                    {`@keyframes spin {
                        to { transform: rotate(360deg); }
                    }`}
                </style>
                <div style={styles.spinner} />
                <span>Loading...</span>
            </div>
        );
    }

    if (isAuthed) {
        return <Navigate to="/dashboard" replace />;
    }

    return (
        <div style={styles.container}>
            <style>
                {`@keyframes spin {
                    to { transform: rotate(360deg); }
                }`}
            </style>
            
            <div style={styles.logoSection}>
                <div style={styles.logo}>📅</div>
                <h1 style={styles.title}>Aria</h1>
                <p style={styles.tagline}>
                    Smart scheduling for teams, clinics, studios, and organizations
                </p>
            </div>

            <div style={styles.card}>
                <h2 style={styles.cardTitle}>Sign in to continue</h2>

                <SupabaseAuth
                    supabaseClient={supabase}
                    appearance={{
                        theme: ThemeSupa,
                        className: {
                            container: "border-0 p-0",
                            button: "rounded-lg font-medium",
                            input: "rounded-lg",
                            label: "text-sm text-gray-600",
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
                                button_label: "Continue with Google",
                            },
                        },
                    }}
                />

                <div style={styles.features}>
                    <div style={styles.feature}>
                        <span>✓</span>
                        <span>Drag & drop scheduling</span>
                    </div>
                    <div style={styles.feature}>
                        <span>✓</span>
                        <span>Recurring sessions</span>
                    </div>
                    <div style={styles.feature}>
                        <span>✓</span>
                        <span>Easy participant management</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
