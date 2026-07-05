import { useEffect } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import client from '../api/client'

const NAV = [
  { to: '/',           icon: '📊', label: 'Dashboard'  },
  { to: '/gastos',     icon: '💸', label: 'Gastos'     },
  { to: '/ingresos',   icon: '💰', label: 'Ingresos'   },
  { to: '/prestamos',  icon: '🤝', label: 'Préstamos'  },
  { to: '/tarjetas',   icon: '💳', label: 'Tarjetas'   },
  { to: '/patrimonio', icon: '💎', label: 'Patrimonio' },
  { to: '/config',     icon: '⚙️', label: 'Config'     },
]

const navStyle = isActive => ({
  display: 'flex', alignItems: 'center', gap: 10,
  padding: '10px 12px', borderRadius: 8, marginBottom: 4,
  textDecoration: 'none', fontSize: 14, fontWeight: 500,
  background: isActive ? '#E1F5EE' : 'transparent',
  color: isActive ? '#0F6E56' : '#374151',
  transition: 'all .15s'
})

export default function Layout({ children }) {
  const { usuario, logout } = useAuth()
  const navigate = useNavigate()
  const isAdmin  = usuario?.id === 1
  const pingMin  = Number(localStorage.getItem('pingMin')) || 5

  const handleLogout = () => { logout(); navigate('/login') }

  useEffect(() => {
    const interval = setInterval(() => {
      client.post('/api/admin/sesiones/ping').catch(() => {})
    }, pingMin * 60 * 1000)
    return () => clearInterval(interval)
  }, [pingMin])

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#f5f5f4', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>

      <aside style={{
        width: 220, background: '#fff', borderRight: '1px solid #e5e7eb',
        display: 'flex', flexDirection: 'column', padding: '1.5rem 0',
        position: 'fixed', top: 0, left: 0, bottom: 0, zIndex: 100
      }} className="sidebar">
        <div style={{ padding: '0 1.25rem 1.5rem', borderBottom: '1px solid #f3f4f6' }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#1D9E75' }}>💰 Mis Finanzas</div>
          <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 4 }}>{usuario?.nombre}</div>
        </div>

        <nav style={{ flex: 1, padding: '1rem 0.75rem' }}>
          {NAV.map(({ to, icon, label }) => (
            <NavLink key={to} to={to} end={to === '/'}
              style={({ isActive }) => navStyle(isActive)}>
              <span style={{ fontSize: 16 }}>{icon}</span>
              {label}
            </NavLink>
          ))}
          {isAdmin && (
            <>
              <div style={{ height: 1, background: '#f3f4f6', margin: '8px 4px' }} />
              <NavLink to="/admin" style={({ isActive }) => navStyle(isActive)}>
                <span style={{ fontSize: 16 }}>🛡️</span>
                Admin
              </NavLink>
            </>
          )}
        </nav>

        <div style={{ padding: '0 0.75rem' }}>
          <button onClick={handleLogout} style={{
            width: '100%', padding: '10px 12px', border: '1px solid #e5e7eb',
            borderRadius: 8, background: 'transparent', cursor: 'pointer',
            fontSize: 13, color: '#6b7280', display: 'flex', alignItems: 'center', gap: 8
          }}>
            🚪 Cerrar sesión
          </button>
        </div>
      </aside>

      <main style={{ marginLeft: 220, flex: 1, padding: '2rem', maxWidth: 'calc(100vw - 220px)' }}>
        {children}
      </main>

      <nav style={{
        display: 'none', position: 'fixed', bottom: 0, left: 0, right: 0,
        background: '#fff', borderTop: '1px solid #e5e7eb', zIndex: 100, padding: '8px 0'
      }} className="bottom-nav">
        {NAV.map(({ to, icon, label }) => (
          <NavLink key={to} to={to} end={to === '/'}
            style={({ isActive }) => ({
              flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
              gap: 2, textDecoration: 'none', fontSize: 10, fontWeight: 500,
              color: isActive ? '#1D9E75' : '#9ca3af', padding: '4px 0'
            })}>
            <span style={{ fontSize: 20 }}>{icon}</span>
            {label}
          </NavLink>
        ))}
      </nav>

      <style>{`
        @media (max-width: 768px) {
          .sidebar { display: none !important; }
          .bottom-nav { display: flex !important; }
          main { margin-left: 0 !important; max-width: 100vw !important; padding: 1rem 1rem 80px !important; }
        }
      `}</style>
    </div>
  )
}
