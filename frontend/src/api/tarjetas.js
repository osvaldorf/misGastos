import client from './client'

export const getTarjetas        = () => client.get('/api/tarjetas')
export const getTarjetasResumen = () => client.get('/api/tarjetas/resumen')
export const createTarjeta      = (data) => client.post('/api/tarjetas', data)
export const updateTarjeta      = (id, data) => client.put(`/api/tarjetas/${id}`, data)
export const deleteTarjeta      = (id) => client.delete(`/api/tarjetas/${id}`)
export const getEstados         = (tarjetaId) => client.get(`/api/tarjetas/${tarjetaId}/estados`)
export const upsertEstado       = (tarjetaId, data) => client.post(`/api/tarjetas/${tarjetaId}/estados`, data)
