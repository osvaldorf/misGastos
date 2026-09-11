import client from './client'

export const getRollup   = (params) => client.get('/api/reportes/rollup', { params })
export const getComparar = (params) => client.get('/api/reportes/comparar', { params })
