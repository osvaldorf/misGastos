import client from './client'

export const getSesiones = () => client.get('/api/admin/sesiones')
export const getUsuariosAdmin = () => client.get('/api/admin/usuarios')
export const pingSesion = () => client.post('/api/admin/sesiones/ping')
