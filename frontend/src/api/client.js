import axios from 'axios'

const API_URL = import.meta.env.VITE_API_URL || ''

const client = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' }
})

// Interceptor — agrega el token JWT a cada request
client.interceptors.request.use(config => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Interceptor — maneja errores globalmente
client.interceptors.response.use(
  res => res,
  err => {
    if (err.response?.status === 401 || err.response?.status === 403) {
      if (window.__clearAuth) {
        window.__clearAuth()
      } else {
        localStorage.removeItem('token')
        localStorage.removeItem('usuario')
      }
    }
    return Promise.reject(err)
  }
)

export default client
