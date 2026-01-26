import React, { useState, useEffect, useCallback } from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import AuthPage from './pages/AuthPage.tsx'
import ProtectedRoute from './components/ProtectedRoute.tsx'
import FloatingChat from './components/FloatingChat.tsx'
import { supabase } from './lib/supabase'

const CHAT_STORAGE_KEY = 'aria_chat_messages';

const AvailabilityFormPage = React.lazy(() => import('./pages/AvailabilityFormPage.tsx'))
const DashboardPage = React.lazy(() => import('./pages/DashboardPage.tsx'))
const SchedulePage = React.lazy(() => import('./pages/SchedulePage.tsx'))
const AccountPage = React.lazy(() => import('./pages/AccountPage.tsx'))
const HelpPage = React.lazy(() => import('./pages/HelpPage.tsx'))
const AboutPage = React.lazy(() => import('./pages/AboutPage.tsx'))

const App = () => {
    const location = useLocation();
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const checkAuth = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            setIsAuthenticated(!!session);
            setLoading(false);
        };
        checkAuth();

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setIsAuthenticated(!!session);
            // Clear chat on logout
            if (!session) {
                sessionStorage.removeItem(CHAT_STORAGE_KEY);
            }
        });

        return () => subscription.unsubscribe();
    }, []);

    // Callback to refresh schedules when chat creates/edits/trashes
    const handleScheduleChange = useCallback(() => {
        // Trigger a custom event that DashboardPage can listen to
        window.dispatchEvent(new CustomEvent('aria-schedule-change'));
    }, []);

    // Callback to open auto-schedule preview from chat
    const handleShowAutoSchedule = useCallback(() => {
        window.dispatchEvent(new CustomEvent('aria-show-auto-schedule'));
    }, []);

    // Show chat on all pages except auth page
    const showChat = !loading && isAuthenticated && location.pathname !== '/';

    return (
        <React.Suspense fallback={<div>Loading...</div>}>
            <Routes>
                <Route path="/" element={<AuthPage />} />
                <Route path="/form/:scheduleId" element={<AvailabilityFormPage />} />
                <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
                <Route path="/schedule/:scheduleId" element={<ProtectedRoute><SchedulePage /></ProtectedRoute>} />
                <Route path="/account" element={<ProtectedRoute><AccountPage /></ProtectedRoute>} />
                <Route path="/help" element={<ProtectedRoute><HelpPage /></ProtectedRoute>} />
                <Route path="/about" element={<ProtectedRoute><AboutPage /></ProtectedRoute>} />
                <Route path="*" element={<Navigate to="/" />} />
            </Routes>
            {showChat && <FloatingChat onScheduleChange={handleScheduleChange} onShowAutoSchedule={handleShowAutoSchedule} />}
        </React.Suspense>
    )
}

export default App