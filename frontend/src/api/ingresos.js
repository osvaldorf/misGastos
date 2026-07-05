import client from './client'

export const getIngresos   = (params) => client.get('/api/ingresos', { params })
export const createIngreso = (data)   => client.post('/api/ingresos', data)
export const deleteIngreso = (id)     => client.delete(`/api/ingresos/${id}`)
