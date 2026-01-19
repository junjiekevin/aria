import React from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import AuthPage from './pages/AuthPage.tsx'
import ProtectedRoute from './components/ProtectedRoute.tsx'

const StudentFormPage = React.lazy(() => import('./pages/StudentFormPage.tsx'))
const DashboardPage = React.lazy(() => import('./pages/DashboardPage.tsx'))
const LandingPage = React.lazy(() => import('./pages/LandingPage.tsx'))
const SchedulePage = React.lazy(() => import('./pages/SchedulePage.tsx'))
const AccountPage = React.lazy(() => import('./pages/AccountPage.tsx'))
const HelpPage = React.lazy(() => import('./pages/HelpPage.tsx'))
const AboutPage = React.lazy(() => import('./pages/AboutPage.tsx'))

const App = () => {
    return (
        <React.Suspense fallback={<div>Loading...</div>}>
            <Routes>
                <Route path="/" element={<LandingPage />} />
                <Route path="/form/:scheduleId" element={<StudentFormPage />} />
                <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
                <Route path="/schedule/:scheduleId" element={<ProtectedRoute><SchedulePage /></ProtectedRoute>} />
                <Route path="/account" element={<ProtectedRoute><AccountPage /></ProtectedRoute>} />
                <Route path="/help" element={<ProtectedRoute><HelpPage /></ProtectedRoute>} />
                <Route path="/about" element={<ProtectedRoute><AboutPage /></ProtectedRoute>} />
                <Route path="/auth" element={<AuthPage />} />
                <Route path="*" element={<Navigate to="/" />} />
            </Routes>
        </React.Suspense>
    )
}

export default App