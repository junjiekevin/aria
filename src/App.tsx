import React from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'

const StudentFormPage = React.lazy(() => import('./pages/StudentFormPage.tsx'))
const DashboardPage = React.lazy(() => import('./pages/DashboardPage.tsx'))
const LandingPage = React.lazy(() => import('./pages/LandingPage.tsx'))

const App = () => {
    return (
        <React.Suspense fallback={<div>Loading...</div>}>
            <Routes>
                <Route path="/" element={<LandingPage />} />
                <Route path="/form" element={<StudentFormPage />} />
                <Route path="/dashboard" element={<DashboardPage />} />
                <Route path="*" element={<Navigate to="/" />} />
            </Routes>
        </React.Suspense>
    )
}

export default App