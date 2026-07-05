import { createContext, useContext, useState, useEffect } from 'react'
import client from '../api/client'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(() => {
    try {
      const u = localStorage.getItem('usuario')
      return u ? JSON.parse(u) : null
    } catch {
      return null
    }
  })

  const login = async (email, password) => {
    const res = await client.post('/api/auth/login', { email, password })
    const { token, usuario_id, nombre } = res.data
    const u = { id: usuario_id, nombre, email }
    localStorage.setItem('token', token)
    localStorage.setItem('usuario', JSON.stringify(u))
    setUsuario(u)
    return u
  }

  const logout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('usuario')
    setUsuario(null)
  }

  useEffect(() => {
    window.__clearAuth = logout
  }, [])

  return (
    <AuthContext.Provider value={{ usuario, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
