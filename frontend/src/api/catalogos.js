import client from './client'

export const getCategorias    = ()        => client.get('/api/catalogos/categorias')
export const createCategoria  = (data)    => client.post('/api/catalogos/categorias', data)
export const updateCategoria  = (id, data)=> client.put(`/api/catalogos/categorias/${id}`, data)
export const deleteCategoria  = (id)      => client.delete(`/api/catalogos/categorias/${id}`)

export const getCuentas       = ()        => client.get('/api/catalogos/cuentas')
export const createCuenta     = (data)    => client.post('/api/catalogos/cuentas', data)
export const updateCuenta     = (id, data)=> client.put(`/api/catalogos/cuentas/${id}`, data)
export const deleteCuenta     = (id)      => client.delete(`/api/catalogos/cuentas/${id}`)

export const getDestinatarios    = ()        => client.get('/api/catalogos/destinatarios')
export const createDestinatario  = (data)    => client.post('/api/catalogos/destinatarios', data)
export const updateDestinatario  = (id, data)=> client.put(`/api/catalogos/destinatarios/${id}`, data)
export const deleteDestinatario  = (id)      => client.delete(`/api/catalogos/destinatarios/${id}`)

export const getFuentes       = ()        => client.get('/api/catalogos/fuentes')
export const createFuente     = (data)    => client.post('/api/catalogos/fuentes', data)
export const updateFuente     = (id, data)=> client.put(`/api/catalogos/fuentes/${id}`, data)
export const deleteFuente     = (id)      => client.delete(`/api/catalogos/fuentes/${id}`)

export const getPrestatarios    = (params)  => client.get('/api/catalogos/prestatarios', { params })
export const createPrestatario  = (data)    => client.post('/api/catalogos/prestatarios', data)
export const updatePrestatario  = (id, data)=> client.put(`/api/catalogos/prestatarios/${id}`, data)
export const deletePrestatario  = (id)      => client.delete(`/api/catalogos/prestatarios/${id}`)

export const getFuentesPrestamo = ()        => client.get('/api/catalogos/fuentes-prestamo')
export const getTiposCambio     = ()        => client.get('/api/catalogos/tipos-cambio')

export const cambiarPassword = (data) => client.put('/api/auth/cambiar-password', data)
