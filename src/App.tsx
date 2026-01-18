import React from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import AuthPage from './pages/AuthPage.tsx'
import ProtectedRoute from './components/ProtectedRoute.tsx'

const StudentFormPage = React.lazy(() => import('./pages/StudentFormPage.tsx'))
const DashboardPage = React.lazy(() => import('./pages/DashboardPage.tsx'))
const LandingPage = React.lazy(() => import('./pages/LandingPage.tsx'))
const SchedulePage = React.lazy(() => import('./pages/SchedulePage.tsx'))

const App = () => {
    return (
        <React.Suspense fallback={<div>Loading...</div>}>
            <Routes>
                <Route path="/" element={<LandingPage />} />
                <Route path="/form" element={<StudentFormPage />} />
                <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
                <Route path="/schedule/:scheduleId" element={<ProtectedRoute><SchedulePage /></ProtectedRoute>} />
                <Route path="/auth" element={<AuthPage />} />
                <Route path="*" element={<Navigate to="/" />} />
            </Routes>
        </React.Suspense>
    )
}

export default App