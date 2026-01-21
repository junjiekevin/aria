import { useEffect, useState } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { Auth as SupabaseAuth, ThemeSupa } from "@supabase/auth-ui-react";
import { supabase } from "../lib/supabase";

const styles: Record<string, React.CSSProperties> = {
    container: {
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.5rem',
        backgroundColor: '#fafaf9',
    },
    card: {
        width: '100%',
        maxWidth: '420px',
        backgroundColor: 'white',
        borderRadius: '12px',
        padding: '2.5rem 2rem',
        boxShadow: '0 1px 3px rgba(0,0,0,0.08), 0 4px 12px rgba(0,0,0,0.04)',
    },
    logo: {
        fontSize: '2rem',
        fontWeight: '700',
        color: '#111827',
        textAlign: 'center',
        marginBottom: '0.5rem',
        letterSpacing: '-0.025em',
    },
    tagline: {
        fontSize: '1rem',
        color: '#6b7280',
        textAlign: 'center',
        marginBottom: '2rem',
        lineHeight: '1.5',
    },
    sectionTitle: {
        fontSize: '0.875rem',
        fontWeight: '600',
        color: '#111827',
        marginBottom: '0.75rem',
        marginTop: '0',
    },
    featureList: {
        listStyle: 'none',
        padding: 0,
        margin: 0,
    },
    featureItem: {
        display: 'flex',
        alignItems: 'flex-start',
        gap: '0.75rem',
        padding: '0.5rem 0',
        fontSize: '0.875rem',
        color: '#4b5563',
        lineHeight: '1.4',
    },
    featureIcon: {
        width: '18px',
        height: '18px',
        flexShrink: 0,
        marginTop: '2px',
    },
    divider: {
        height: '1px',
        backgroundColor: '#e5e7eb',
        margin: '1.5rem 0',
    },
    footer: {
        fontSize: '0.75rem',
        color: '#9ca3af',
        textAlign: 'center',
        marginTop: '1.5rem',
        lineHeight: '1.5',
    },
    loading: {
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#fafaf9',
        fontSize: '0.875rem',
        color: '#6b7280',
    },
};

function CheckIcon() {
    return (
        <svg style={styles.featureIcon} viewBox="0 0 24 24" fill="none" stroke="#f97316" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
    );
}

export default function AuthPage() {
    const navigate = useNavigate();
    const [checking, setChecking] = useState(true);
    const [isAuthed, setIsAuthed] = useState(false);

    useEffect(() => {
        let isMounted = true;

        (async () => {
            const { data: { session } } = await supabase.auth.getSession();

            if (!isMounted) return;

            if (session) {
                setIsAuthed(true);
                setChecking(false);
                return;
            }

            const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, newSession) => {
                if (newSession) {
                    setIsAuthed(true);
                    setTimeout(() => navigate("/dashboard"), 50);
                }
            });

            setChecking(false);

            return () => {
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
                Loading...
            </div>
        );
    }

    if (isAuthed) {
        return <Navigate to="/dashboard" replace />;
    }

    return (
        <div style={styles.container}>
            <div style={styles.card}>
                <h1 style={styles.logo}>Aria</h1>
                <p style={styles.tagline}>
                    Smart scheduling for teams, clinics,<br />studios, and organizations
                </p>

                <SupabaseAuth
                    supabaseClient={supabase}
                    appearance={{
                        theme: ThemeSupa,
                        variables: {
                            default: {
                                colors: {
                                    brand: '#f97316',
                                    brandAccent: '#ea580c',
                                },
                                radii: {
                                    borderRadiusButton: '8px',
                                    inputBorderRadius: '8px',
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
                                button_label: "Sign in with Google",
                            },
                        },
                    }}
                />

                <div style={styles.divider} />

                <h2 style={styles.sectionTitle}>Features</h2>
                <ul style={styles.featureList}>
                    <li style={styles.featureItem}>
                        <CheckIcon />
                        <span>Drag & drop scheduling interface</span>
                    </li>
                    <li style={styles.featureItem}>
                        <CheckIcon />
                        <span>Recurring sessions (weekly, biweekly, monthly)</span>
                    </li>
                    <li style={styles.featureItem}>
                        <CheckIcon />
                        <span>Easy participant management</span>
                    </li>
                    <li style={styles.featureItem}>
                        <CheckIcon />
                        <span>Swap and move sessions instantly</span>
                    </li>
                </ul>

                <p style={styles.footer}>
                    By signing in, you agree to our terms of service and privacy policy.
                </p>
            </div>
        </div>
    );
}
