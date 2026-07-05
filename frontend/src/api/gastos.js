import client from './client'

export const getGastos        = (params) => client.get('/api/gastos', { params })
export const getGastosResumen = (params) => client.get('/api/gastos/resumen', { params })
export const createGasto      = (data)   => client.post('/api/gastos', data)
export const updateGasto      = (id, data)=> client.put(`/api/gastos/${id}`, data)
export const deleteGasto      = (id)     => client.delete(`/api/gastos/${id}`)
