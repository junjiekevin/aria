import { useEffect, useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { Auth as SupabaseAuth, ThemeSupa } from '@supabase/auth-ui-react';
import { supabase } from '../lib/supabase';
import logo from '../assets/images/logo-with-text.png';
import Modal from '../components/Modal';

// Inline Icons to avoid build issues
const CalendarIcon = ({ size = 24, className = '' }) => (
    <svg width={size} height={size} className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
        <line x1="16" y1="2" x2="16" y2="6"></line>
        <line x1="8" y1="2" x2="8" y2="6"></line>
        <line x1="3" y1="10" x2="21" y2="10"></line>
    </svg>
);

const UsersIcon = ({ size = 24, className = '' }) => (
    <svg width={size} height={size} className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
        <circle cx="9" cy="7" r="4"></circle>
        <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
        <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
    </svg>
);

const SparklesIcon = ({ size = 24, className = '' }) => (
    <svg width={size} height={size} className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"></path>
    </svg>
);

const ClockIcon = ({ size = 24, className = '' }) => (
    <svg width={size} height={size} className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"></circle>
        <polyline points="12 6 12 12 16 14"></polyline>
    </svg>
);

export default function AuthPage() {
    const navigate = useNavigate();
    const [checking, setChecking] = useState(true);
    const [isAuthed, setIsAuthed] = useState(false);
    const [showPrivacy, setShowPrivacy] = useState(false);
    const [showTerms, setShowTerms] = useState(false);

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
                    setTimeout(() => navigate('/dashboard'), 50);
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
            <div style={{
                minHeight: '100vh',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'linear-gradient(135deg, #fff7ed 0%, #ffedd5 100%)',
                color: '#f97316',
                fontWeight: 500
            }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
                    <div style={{
                        width: '40px', height: '40px', border: '3px solid #fdba74', borderTopColor: '#f97316', borderRadius: '50%', animation: 'spin 1s linear infinite'
                    }} />
                    <span>Loading Aria...</span>
                </div>
                <style>{'@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }'}</style>
            </div>
        );
    }

    if (isAuthed) {
        return <Navigate to="/dashboard" replace />;
    }

    return (
        <div style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'linear-gradient(135deg, #fff7ed 0%, #fff 50%, #ffedd5 100%)',
            padding: '1.5rem',
            position: 'relative',
            overflow: 'hidden'
        }}>
            {/* Ambient Background Shapes */}
            <div style={{
                position: 'absolute',
                top: '-10%',
                left: '-5%',
                width: '600px',
                height: '600px',
                background: 'radial-gradient(circle, rgba(253, 186, 116, 0.15) 0%, rgba(253, 186, 116, 0) 70%)',
                borderRadius: '50%',
                zIndex: 0,
            }} />
            <div style={{
                position: 'absolute',
                bottom: '-10%',
                right: '-5%',
                width: '500px',
                height: '500px',
                background: 'radial-gradient(circle, rgba(249, 115, 22, 0.1) 0%, rgba(249, 115, 22, 0) 70%)',
                borderRadius: '50%',
                zIndex: 0,
            }} />

            <div style={{
                width: '100%',
                maxWidth: '440px',
                backgroundColor: 'rgba(255, 255, 255, 0.8)',
                backdropFilter: 'blur(12px)',
                borderRadius: '24px',
                padding: '3rem 2.5rem',
                boxShadow: '0 20px 40px -12px rgba(0, 0, 0, 0.1), 0 0 0 1px rgba(255, 255, 255, 0.5)',
                position: 'relative',
                zIndex: 1,
            }}>
                <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
                    <img
                        src={logo}
                        alt="Aria"
                        style={{
                            height: '64px',
                            display: 'block',
                            margin: '0 auto 1.5rem',
                            filter: 'drop-shadow(0 4px 6px rgba(249, 115, 22, 0.2))'
                        }}
                    />
                    <h1 style={{
                        fontSize: '1.5rem',
                        fontWeight: '700',
                        color: '#111827',
                        marginBottom: '0.75rem',
                        letterSpacing: '-0.02em',
                        lineHeight: '1.2'
                    }}>
                        Scheduling, simplified.
                    </h1>
                    <p style={{
                        fontSize: '1rem',
                        color: '#4b5563',
                        lineHeight: '1.6',
                    }}>
                        Your assistant for<br />
                        <span style={{ color: '#f97316', fontWeight: '500' }}>adaptive, effortless planning.</span>
                    </p>
                </div>

                <div style={{
                    marginBottom: '2.5rem',
                    padding: '0.25rem',
                    background: 'white',
                    borderRadius: '12px',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
                }}>
                    <SupabaseAuth
                        supabaseClient={supabase}
                        appearance={{
                            theme: ThemeSupa,
                            variables: {
                                default: {
                                    colors: {
                                        brand: '#f97316',
                                        brandAccent: '#ea580c',
                                        inputText: '#374151',
                                        inputBorder: '#e5e7eb',
                                    },
                                    radii: {
                                        borderRadiusButton: '10px',
                                        inputBorderRadius: '10px',
                                    },
                                    space: {
                                        buttonPadding: '12px 16px',
                                        inputPadding: '12px 16px',
                                    },
                                    fonts: {
                                        bodyFontFamily: 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
                                        buttonFontFamily: 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
                                    }
                                },
                            },
                            style: {
                                button: {
                                    fontSize: '0.95rem',
                                    fontWeight: '500',
                                    boxShadow: '0 2px 4px rgba(249, 115, 22, 0.1)',
                                },
                                container: {
                                    gap: '1rem',
                                }
                            }
                        }}
                        providers={['google']}
                        onlyThirdPartyProviders
                        socialLayout="vertical"
                        redirectTo={window.location.origin + '/dashboard'}
                        localization={{
                            variables: {
                                sign_in: {
                                    button_label: 'Continue with Google',
                                },
                            },
                        }}
                    />
                </div>

                <div style={{ height: '1px', background: 'linear-gradient(to right, transparent, #e5e7eb, transparent)', marginBottom: '2rem' }} />

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem 1rem' }}>
                    <FeatureItem icon={<SparklesIcon size={18} />} text="AI Scheduling Assistant" />
                    <FeatureItem icon={<CalendarIcon size={18} />} text="Visual Timetable" />
                    <FeatureItem icon={<UsersIcon size={18} />} text="Participant Tracking" />
                    <FeatureItem icon={<ClockIcon size={18} />} text="Smart Recurring Events" />
                </div>

                <p style={{
                    fontSize: '0.75rem',
                    color: '#9ca3af',
                    textAlign: 'center',
                    marginTop: '2.5rem',
                    lineHeight: '1.5'
                }}>
                    By signing in, you agree to our<br />
                    <button onClick={() => setShowTerms(true)} style={{ background: 'none', border: 'none', padding: 0, color: '#6b7280', textDecoration: 'underline', cursor: 'pointer', fontFamily: 'inherit', fontSize: 'inherit' }}>Terms of Service</button> and <button onClick={() => setShowPrivacy(true)} style={{ background: 'none', border: 'none', padding: 0, color: '#6b7280', textDecoration: 'underline', cursor: 'pointer', fontFamily: 'inherit', fontSize: 'inherit' }}>Privacy Policy</button>.
                </p>
            </div>

            {/* Legal Modals */}
            <Modal isOpen={showPrivacy} onClose={() => setShowPrivacy(false)} title="Privacy Policy">
                <div style={{ color: '#374151', lineHeight: '1.6' }}>
                    <p style={{ marginBottom: '1.5rem', fontSize: '1.05rem', color: '#111827' }}>Your trust is not something we take for granted. We believe that privacy should be simple, transparent, and respectful.</p>

                    <h4 style={{ marginBottom: '0.5rem', color: '#111827', fontWeight: 600, fontSize: '0.95rem' }}>Respecting Your Information</h4>
                    <p style={{ marginBottom: '1.25rem' }}>We collect only what is essential: your name and email to identify you. We do not sell, trade, or share your personal history with advertisers. Your data belongs to you, not us.</p>

                    <h4 style={{ marginBottom: '0.5rem', color: '#111827', fontWeight: 600, fontSize: '0.95rem' }}>Stewardship & Security</h4>
                    <p style={{ marginBottom: '1.25rem' }}>We treat your schedules with the care they deserve. Aria uses industry-leading encryption and security architecture to ensure your work stays private. Only you hold the keys to your data.</p>

                    <h4 style={{ marginBottom: '0.5rem', color: '#111827', fontWeight: 600, fontSize: '0.95rem' }}>Freedom of Choice</h4>
                    <p>You remain in full control. Whether you want to export your data or leave the platform entirely, we ensure the door is always open. You can request a complete deletion of your account at any time.</p>
                </div>
            </Modal>

            <Modal isOpen={showTerms} onClose={() => setShowTerms(false)} title="Terms of Service">
                <div style={{ color: '#374151', lineHeight: '1.6' }}>
                    <p style={{ marginBottom: '1.5rem', fontSize: '1.05rem', color: '#111827' }}>Aria is built on a foundation of mutual respect. These terms outline how we can build a reliable space together.</p>

                    <h4 style={{ marginBottom: '0.5rem', color: '#111827', fontWeight: 600, fontSize: '0.95rem' }}>Responsible Use</h4>
                    <p style={{ marginBottom: '1.25rem' }}>Aria is designed to bring order to your professional life. We ask that you use it with the same integrity you bring to your work. Please keep your account secure and use the platform as intended.</p>

                    <h4 style={{ marginBottom: '0.5rem', color: '#111827', fontWeight: 600, fontSize: '0.95rem' }}>Our Commitment</h4>
                    <p style={{ marginBottom: '1.25rem' }}>We pour our energy into making Aria reliable, accurate, and helpful. While we strive for perfection, technology is a partner, not a guarantee. We provide the service "as is," but we promise to always work earnestly to resolve any issues that arise.</p>

                    <h4 style={{ marginBottom: '0.5rem', color: '#111827', fontWeight: 600, fontSize: '0.95rem' }}>Growing Together</h4>
                    <p>As we learn and improve, Aria may evolve. We promise to communicate significant changes clearly, ensuring you always feel at home with the tools you rely on.</p>
                </div>
            </Modal>
        </div>
    );
}

function FeatureItem({ icon, text }: { icon: React.ReactNode, text: string }) {
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{
                color: '#f97316',
                background: '#fff7ed',
                padding: '6px',
                borderRadius: '8px',
                display: 'flex',
                flexShrink: 0
            }}>
                {icon}
            </div>
            <span style={{ fontSize: '0.8125rem', fontWeight: 500, color: '#4b5563', lineHeight: '1.3' }}>{text}</span>
        </div>
    );
}
