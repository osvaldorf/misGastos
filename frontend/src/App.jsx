import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { useState, useEffect } from 'react'
import Layout from './components/Layout'
import Onboarding from './components/Onboarding'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Gastos from './pages/Gastos'
import Ingresos from './pages/Ingresos'
import Prestamos from './pages/Prestamos'
import Tarjetas from './pages/Tarjetas'
import Config from './pages/Config'
import Admin from './pages/Admin'
import Patrimonio from './pages/Patrimonio'
import client from './api/client'

function PrivateRoute({ children }) {
  const { usuario } = useAuth()
  const [onboardingDone, setOnboardingDone] = useState(null)

  useEffect(() => {
    if (!usuario) return
    client.get('/api/onboarding/status')
      .then(r => setOnboardingDone(r.data.completado))
      .catch(() => setOnboardingDone(true))
  }, [usuario])

  if (!usuario) return <Navigate to="/login" replace />
  if (onboardingDone === null) return null

  if (!onboardingDone) {
    return (
      <Onboarding onComplete={() => setOnboardingDone(true)} />
    )
  }

  return <Layout>{children}</Layout>
}

function AppRoutes() {
  const { usuario } = useAuth()
  return (
    <Routes>
      <Route path="/login"      element={usuario ? <Navigate to="/" replace /> : <Login />} />
      <Route path="/"           element={<PrivateRoute><Dashboard /></PrivateRoute>} />
      <Route path="/gastos"     element={<PrivateRoute><Gastos /></PrivateRoute>} />
      <Route path="/ingresos"   element={<PrivateRoute><Ingresos /></PrivateRoute>} />
      <Route path="/prestamos"  element={<PrivateRoute><Prestamos /></PrivateRoute>} />
      <Route path="/tarjetas"   element={<PrivateRoute><Tarjetas /></PrivateRoute>} />
      <Route path="/patrimonio" element={<PrivateRoute><Patrimonio /></PrivateRoute>} />
      <Route path="/config"     element={<PrivateRoute><Config /></PrivateRoute>} />
      <Route path="/admin"      element={<PrivateRoute><Admin /></PrivateRoute>} />
      <Route path="*"           element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  )
}
