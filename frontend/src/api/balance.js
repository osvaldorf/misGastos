import client from './client'

export const getResumen       = ()       => client.get('/api/balance/resumen')
export const getFlujoMensual  = (params) => client.get('/api/balance/flujo-mensual', { params })
export const getPorCategoria  = (params) => client.get('/api/balance/por-categoria', { params })
export const getPorFuente     = (params) => client.get('/api/balance/por-fuente', { params })
export const getPrestamos     = ()       => client.get('/api/balance/prestamos')
export const getPosicionMoneda= ()       => client.get('/api/balance/posicion-moneda')
