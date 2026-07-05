import client from './client'

export const getPatrimonioCuentas   = () => client.get('/api/patrimonio/cuentas')
export const updateCuentaPatrimonio = (id, data) => client.put(`/api/patrimonio/cuentas/${id}`, data)
export const getSaldosPeriodo       = (anio, mes) => client.get('/api/patrimonio/saldos', { params: { anio, mes } })
export const getSaldosUltimoMes     = () => client.get('/api/patrimonio/saldos/ultimo-mes')
export const guardarSaldosMes       = (data) => client.post('/api/patrimonio/saldos/mes', data)
export const getPatrimonioResumen   = () => client.get('/api/patrimonio/resumen')
export const getPatrimonioEvolucion = () => client.get('/api/patrimonio/evolucion')
