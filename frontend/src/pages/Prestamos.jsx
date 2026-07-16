import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { getPrestamos } from '../api/balance'
import { createPrestatario, updatePrestatario, deletePrestatario } from '../api/catalogos'
import { card, inputStyle, labelStyle, btnPrimary, btnSecondary, btnDanger, Modal, ErrorBox, fmtMoney, calcularCuotaFija } from '../components/ui'

const emptyForm = { nombre: '', capital_original: '', tasa_interes: '', pagos_por_anio: 12, numero_pagos: '', fecha_prestamo: '', fecha_vencimiento: '', notas: '' }

export default function Prestamos() {
  const navigate = useNavigate()
  const [prestamos, setPrestamos] = useState([])
  const [estatusFiltro, setEstatusFiltro] = useState('Activo')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)

  const cargar = useCallback(() => {
    getPrestamos().then(r => setPrestamos(r.data)).catch(() => {})
  }, [])

  useEffect(() => { cargar() }, [cargar])

  const filtrados = estatusFiltro === 'Todos' ? prestamos : prestamos.filter(p => p.estatus === estatusFiltro)
  const capitalActivo = prestamos.filter(p => p.estatus === 'Activo').reduce((s, p) => s + Number(p.capital_original || 0), 0)
  const saldoPendiente = prestamos.filter(p => p.estatus === 'Activo').reduce((s, p) => s + Number(p.saldo_pendiente || 0), 0)
  const interesesCobrados = prestamos.reduce((s, p) => s + Number(p.intereses_cobrados || 0), 0)
  const liquidados = prestamos.filter(p => p.estatus === 'Liquidado').length

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const openNuevo = () => { setEditing(null); setForm(emptyForm); setError(null); setModalOpen(true) }
  const openEditar = p => {
    setEditing(p)
    setForm({
      nombre: p.nombre, capital_original: p.capital_original, tasa_interes: p.tasa_interes || '',
      pagos_por_anio: p.pagos_por_anio || 12, numero_pagos: p.numero_pagos || '',
      fecha_prestamo: p.fecha_prestamo?.slice(0, 10) || '', fecha_vencimiento: p.fecha_vencimiento?.slice(0, 10) || '',
      notas: p.notas || ''
    })
    setError(null); setModalOpen(true)
  }

  const cuotaEstimada = calcularCuotaFija(form.capital_original, form.tasa_interes, form.pagos_por_anio, form.numero_pagos)

  const submit = async e => {
    e.preventDefault()
    if (!form.nombre || !form.capital_original) { setError('Completa nombre y capital'); return }
    setSaving(true); setError(null)
    const body = {
      nombre: form.nombre, capital_original: Number(form.capital_original),
      tasa_interes: Number(form.tasa_interes || 0),
      pagos_por_anio: Number(form.pagos_por_anio || 12), numero_pagos: form.numero_pagos ? Number(form.numero_pagos) : null,
      fecha_prestamo: form.fecha_prestamo || null, fecha_vencimiento: form.fecha_vencimiento || null,
      notas: form.notas
    }
    try {
      if (editing) await updatePrestatario(editing.id, body)
      else await createPrestatario(body)
      setModalOpen(false); cargar()
    } catch (e) {
      setError(e.response?.data?.detail || 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  const eliminar = async id => {
    if (!confirm('¿Eliminar este prestatario?')) return
    await deletePrestatario(id); cargar()
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>🤝 Préstamos</h1>
        <button style={btnPrimary} onClick={openNuevo}>+ Nuevo prestatario</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 20 }}>
        <div style={card}>
          <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 6 }}>Capital activo</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#8B5CF6' }}>{fmtMoney(capitalActivo)}</div>
        </div>
        <div style={card}>
          <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 6 }}>Saldo pendiente</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#DC2626' }}>{fmtMoney(saldoPendiente)}</div>
        </div>
        <div style={card}>
          <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 6 }}>Intereses cobrados</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#1D9E75' }}>{fmtMoney(interesesCobrados)}</div>
        </div>
        <div style={card}>
          <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 6 }}>Préstamos liquidados</div>
          <div style={{ fontSize: 22, fontWeight: 700 }}>{liquidados}</div>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <select style={{ ...inputStyle, width: 'auto' }} value={estatusFiltro} onChange={e => setEstatusFiltro(e.target.value)}>
          <option value="Todos">Todos</option>
          <option value="Activo">Activo</option>
          <option value="Liquidado">Liquidado</option>
          <option value="Vencido">Vencido</option>
          <option value="Incobrable">Incobrable</option>
        </select>
        <span style={{ color: '#6b7280', fontSize: 14 }}>{filtrados.length} prestatarios</span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {filtrados.map(p => {
          const pct = p.capital_original ? Math.round((p.capital_recuperado / p.capital_original) * 100) : 0
          return (
            <div key={p.id} style={card}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 16 }}>{p.nombre}</div>
                  <div style={{ fontSize: 13, color: '#9ca3af', marginTop: 2 }}>
                    {p.tasa_interes ? `${p.tasa_interes}% anual · ` : ''}
                    {p.numero_pagos ? `Pago ${Math.min(p.pagos_realizados + 1, p.numero_pagos)}/${p.numero_pagos} · ` : ''}
                    Desde {p.fecha_prestamo?.slice(0, 10)}
                    {p.fecha_vencimiento && ` · Vence ${p.fecha_vencimiento.slice(0, 10)}`}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span style={{
                    fontSize: 12, fontWeight: 600, padding: '3px 10px', borderRadius: 20,
                    background: p.estatus === 'Activo' ? '#E1F5EE' : '#f3f4f6',
                    color: p.estatus === 'Activo' ? '#0F6E56' : '#6b7280'
                  }}>{p.estatus}</span>
                  <button style={btnSecondary} onClick={() => navigate('/ingresos')}>💵 Pago</button>
                  <button style={btnSecondary} onClick={() => openEditar(p)}>✏️ Editar</button>
                  <button style={btnDanger} onClick={() => eliminar(p.id)}>🗑 Eliminar</button>
                </div>
              </div>

              <div style={{ marginTop: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, color: '#6b7280', marginBottom: 4 }}>
                  <span>Recuperado {pct}%</span>
                  <span>{fmtMoney(p.capital_recuperado)} / {fmtMoney(p.capital_original)}</span>
                </div>
                <div style={{ height: 8, borderRadius: 4, background: '#f3f4f6', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${Math.min(pct, 100)}%`, background: '#1D9E75' }} />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginTop: 14 }}>
                <div>
                  <div style={{ fontSize: 12, color: '#9ca3af' }}>Capital original</div>
                  <div style={{ fontWeight: 600 }}>{fmtMoney(p.capital_original)}</div>
                </div>
                <div>
                  <div style={{ fontSize: 12, color: '#9ca3af' }}>Capital recuperado</div>
                  <div style={{ fontWeight: 600 }}>{fmtMoney(p.capital_recuperado)}</div>
                </div>
                <div>
                  <div style={{ fontSize: 12, color: '#9ca3af' }}>Saldo pendiente</div>
                  <div style={{ fontWeight: 600, color: '#DC2626' }}>{fmtMoney(p.saldo_pendiente)}</div>
                </div>
                <div>
                  <div style={{ fontSize: 12, color: '#9ca3af' }}>Intereses cobrados</div>
                  <div style={{ fontWeight: 600, color: '#1D9E75' }}>{fmtMoney(p.intereses_cobrados)}</div>
                </div>
              </div>
              {p.notas && <div style={{ marginTop: 10, fontSize: 13, color: '#6b7280' }}>📝 {p.notas}</div>}
            </div>
          )
        })}
      </div>

      {modalOpen && (
        <Modal title={editing ? 'Editar prestatario' : 'Nuevo prestatario'} onClose={() => setModalOpen(false)}>
          <form onSubmit={submit}>
            <ErrorBox>{error}</ErrorBox>
            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>Nombre *</label>
              <input style={inputStyle} value={form.nombre} onChange={e => set('nombre', e.target.value)} autoFocus />
            </div>
            <div style={{ display: 'flex', gap: 12, marginBottom: 14 }}>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Capital original *</label>
                <input style={inputStyle} type="number" step="0.01" value={form.capital_original} onChange={e => set('capital_original', e.target.value)} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Tasa de interés anual (%)</label>
                <input style={inputStyle} type="number" step="0.01" value={form.tasa_interes} onChange={e => set('tasa_interes', e.target.value)} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 12, marginBottom: 14 }}>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Pagos por año</label>
                <input style={inputStyle} type="number" step="1" placeholder="12" value={form.pagos_por_anio} onChange={e => set('pagos_por_anio', e.target.value)} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Número de pagos (plazo total)</label>
                <input style={inputStyle} type="number" step="1" placeholder="Ej. 5" value={form.numero_pagos} onChange={e => set('numero_pagos', e.target.value)} />
              </div>
            </div>
            {cuotaEstimada != null && (
              <div style={{ marginBottom: 14, fontSize: 13, color: '#0F6E56', background: '#E1F5EE', borderRadius: 8, padding: '8px 12px' }}>
                💡 Cuota fija estimada por período: <strong>{fmtMoney(cuotaEstimada)}</strong>
              </div>
            )}
            <div style={{ display: 'flex', gap: 12, marginBottom: 14 }}>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Fecha de préstamo</label>
                <input style={inputStyle} type="date" value={form.fecha_prestamo} onChange={e => set('fecha_prestamo', e.target.value)} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Fecha de vencimiento</label>
                <input style={inputStyle} type="date" value={form.fecha_vencimiento} onChange={e => set('fecha_vencimiento', e.target.value)} />
              </div>
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={labelStyle}>Notas</label>
              <input style={inputStyle} placeholder="Opcional..." value={form.notas} onChange={e => set('notas', e.target.value)} />
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button type="button" style={btnSecondary} onClick={() => setModalOpen(false)}>Cancelar</button>
              <button type="submit" disabled={saving} style={{ ...btnPrimary, opacity: saving ? 0.7 : 1 }}>✓ Guardar</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
