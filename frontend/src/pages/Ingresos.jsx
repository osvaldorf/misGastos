import { useEffect, useState, useCallback } from 'react'
import { getIngresos, createIngreso, deleteIngreso } from '../api/ingresos'
import { getCuentas, getFuentes, getFuentesPrestamo } from '../api/catalogos'
import { card, inputStyle, labelStyle, btnPrimary, btnSecondary, btnDanger, Modal, ErrorBox, fmtMoney } from '../components/ui'

const TIPOS = ['Salario', 'Renta', 'Inversión', 'Préstamo', 'Otro']
const emptyForm = { descripcion: '', tipo: 'Salario', fuente_id: '', monto: '', moneda: 'MXN', fecha: new Date().toISOString().slice(0, 10), cuenta_id: '', notas: '', prestatario_id: '', capital: '', intereses: '' }

export default function Ingresos() {
  const [ingresos, setIngresos] = useState([])
  const [cuentas, setCuentas] = useState([])
  const [fuentes, setFuentes] = useState([])
  const [prestatarios, setPrestatarios] = useState([])
  const [filtros, setFiltros] = useState({ tipo: '', fuente_id: '' })
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)

  const fuentesFiltradas = form.tipo ? fuentes.filter(f => f.tipo === form.tipo) : fuentes

  const cargar = useCallback(() => {
    const params = {}
    if (filtros.tipo) params.tipo = filtros.tipo
    if (filtros.fuente_id) params.fuente_id = filtros.fuente_id
    getIngresos(params).then(r => setIngresos(r.data)).catch(() => {})
  }, [filtros])

  useEffect(() => { cargar() }, [cargar])
  useEffect(() => {
    getCuentas().then(r => setCuentas(r.data)).catch(() => {})
    getFuentes().then(r => setFuentes(r.data)).catch(() => {})
    getFuentesPrestamo().then(r => setPrestatarios(r.data)).catch(() => {})
  }, [])

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const setTipo = tipo => {
    if (tipo === 'Préstamo') {
      const fuentePrestamo = fuentes.find(f => f.tipo === 'Préstamo')
      setForm(f => ({ ...f, tipo, fuente_id: fuentePrestamo?.id || '' }))
    } else {
      setForm(f => ({ ...f, tipo, fuente_id: '', prestatario_id: '', capital: '', intereses: '' }))
    }
  }

  const openNuevo = () => { setForm(emptyForm); setError(null); setModalOpen(true) }
  const openPagoPrestamo = p => {
    const fuentePrestamo = fuentes.find(f => f.tipo === 'Préstamo')
    setForm({ ...emptyForm, tipo: 'Préstamo', prestatario_id: p.id, fuente_id: fuentePrestamo?.id || '', descripcion: `Pago préstamo — ${p.nombre}` })
    setError(null); setModalOpen(true)
  }

  const submit = async e => {
    e.preventDefault()
    if (!form.descripcion || !form.monto || !form.fuente_id || !form.cuenta_id) {
      setError('Completa descripción, monto, fuente y cuenta'); return
    }
    if (form.tipo === 'Préstamo' && form.prestatario_id) {
      const cap = Number(form.capital || 0), intr = Number(form.intereses || 0)
      if (Math.round((cap + intr) * 100) !== Math.round(Number(form.monto) * 100)) {
        setError(`Capital (${cap}) + Intereses (${intr}) debe ser igual al Monto (${form.monto})`); return
      }
    }
    setSaving(true); setError(null)
    const body = {
      descripcion: form.descripcion, tipo: form.tipo, fuente_id: Number(form.fuente_id),
      monto: Number(form.monto), moneda: form.moneda, fecha: form.fecha, cuenta_id: Number(form.cuenta_id),
      notas: form.notas,
      prestatario_id: form.tipo === 'Préstamo' && form.prestatario_id ? Number(form.prestatario_id) : null,
      capital: form.tipo === 'Préstamo' ? Number(form.capital || 0) : 0,
      intereses: form.tipo === 'Préstamo' ? Number(form.intereses || 0) : 0,
    }
    try {
      await createIngreso(body)
      setModalOpen(false); cargar()
    } catch (e) {
      setError(e.response?.data?.detail || 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  const eliminar = async id => {
    if (!confirm('¿Eliminar este ingreso?')) return
    await deleteIngreso(id); cargar()
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>💰 Ingresos</h1>
        <button style={btnPrimary} onClick={openNuevo}>+ Nuevo ingreso</button>
      </div>

      {prestatarios.length > 0 && (
        <div style={{ ...card, marginBottom: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 10 }}>🤝 Registrar pago de préstamo</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {prestatarios.map(p => (
              <button key={p.id} onClick={() => openPagoPrestamo(p)} style={{
                padding: '8px 14px', borderRadius: 20, border: '1px solid #ddd6fe', background: '#F5F3FF',
                color: '#6D28D9', fontSize: 13, cursor: 'pointer'
              }}>
                {p.nombre} · {fmtMoney(p.saldo_pendiente)}
              </button>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
        <select style={{ ...inputStyle, width: 'auto' }} value={filtros.tipo} onChange={e => setFiltros(f => ({ ...f, tipo: e.target.value }))}>
          <option value="">Todos los tipos</option>
          {TIPOS.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <select style={{ ...inputStyle, width: 'auto' }} value={filtros.fuente_id} onChange={e => setFiltros(f => ({ ...f, fuente_id: e.target.value }))}>
          <option value="">Todas las fuentes</option>
          {fuentes.map(f => <option key={f.id} value={f.id}>{f.nombre}</option>)}
        </select>
      </div>

      <div style={card}>
        {ingresos.length === 0 ? (
          <div style={{ color: '#9ca3af', textAlign: 'center', padding: '2rem 0' }}>Sin ingresos registrados</div>
        ) : ingresos.map((g, i) => (
          <div key={g.id} style={{
            display: 'flex', alignItems: 'center', gap: 14, padding: '14px 0',
            borderTop: i === 0 ? 'none' : '1px solid #f3f4f6'
          }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: 14.5 }}>{g.descripcion}</div>
              <div style={{ fontSize: 12.5, color: '#9ca3af', display: 'flex', gap: 8, marginTop: 2, flexWrap: 'wrap' }}>
                <span>{g.tipo}</span>
                <span>{g.fuente}</span>
                <span>{g.cuenta}</span>
                {g.prestatario && <span>🤝 {g.prestatario}</span>}
                <span>{g.fecha?.slice(0, 10)}</span>
              </div>
              {g.prestatario && (
                <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>
                  Capital: {fmtMoney(g.capital)} · Intereses: {fmtMoney(g.intereses)}
                </div>
              )}
            </div>
            <div style={{ fontWeight: 700, color: '#1D9E75' }}>{fmtMoney(g.monto, g.moneda)}</div>
            <button style={btnDanger} onClick={() => eliminar(g.id)}>Eliminar</button>
          </div>
        ))}
      </div>

      {modalOpen && (
        <Modal title="Nuevo ingreso" onClose={() => setModalOpen(false)}>
          <form onSubmit={submit}>
            <ErrorBox>{error}</ErrorBox>
            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>Descripción *</label>
              <input style={inputStyle} placeholder="¿De qué ingreso es?" value={form.descripcion} onChange={e => set('descripcion', e.target.value)} autoFocus />
            </div>
            <div style={{ display: 'flex', gap: 12, marginBottom: 14 }}>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Tipo *</label>
                <select style={inputStyle} value={form.tipo} onChange={e => setTipo(e.target.value)}>
                  {TIPOS.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              {form.tipo !== 'Préstamo' && (
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Fuente *</label>
                  <select style={inputStyle} value={form.fuente_id} onChange={e => set('fuente_id', e.target.value)}>
                    <option value="">— Selecciona —</option>
                    {fuentesFiltradas.map(f => <option key={f.id} value={f.id}>{f.nombre}</option>)}
                  </select>
                </div>
              )}
            </div>
            <div style={{ display: 'flex', gap: 12, marginBottom: 14 }}>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Monto total *</label>
                <input style={inputStyle} type="number" step="0.01" placeholder="0.00" value={form.monto} onChange={e => set('monto', e.target.value)} />
              </div>
              <div style={{ width: 160 }}>
                <label style={labelStyle}>Moneda</label>
                <select style={inputStyle} value={form.moneda} onChange={e => set('moneda', e.target.value)}>
                  <option value="MXN">MXN — Peso mexicano</option>
                  <option value="USD">USD — Dólar</option>
                  <option value="EUR">EUR — Euro</option>
                </select>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 12, marginBottom: 14 }}>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Fecha *</label>
                <input style={inputStyle} type="date" value={form.fecha} onChange={e => set('fecha', e.target.value)} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Cuenta destino *</label>
                <select style={inputStyle} value={form.cuenta_id} onChange={e => set('cuenta_id', e.target.value)}>
                  <option value="">— Selecciona —</option>
                  {cuentas.map(c => <option key={c.id} value={c.id}>{c.nombre} ({c.banco})</option>)}
                </select>
              </div>
            </div>

            {form.tipo === 'Préstamo' && (
              <>
                <div style={{ marginBottom: 14 }}>
                  <label style={labelStyle}>Prestatario</label>
                  <select style={inputStyle} value={form.prestatario_id} onChange={e => set('prestatario_id', e.target.value)}>
                    <option value="">— Selecciona prestatario —</option>
                    {prestatarios.map(p => <option key={p.id} value={p.id}>{p.nombre} · Saldo: {fmtMoney(p.saldo_pendiente)}</option>)}
                  </select>
                </div>
                <div style={{ display: 'flex', gap: 12, marginBottom: 14 }}>
                  <div style={{ flex: 1 }}>
                    <label style={labelStyle}>Capital</label>
                    <input style={inputStyle} type="number" step="0.01" placeholder="0.00" value={form.capital} onChange={e => set('capital', e.target.value)} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={labelStyle}>Intereses</label>
                    <input style={inputStyle} type="number" step="0.01" placeholder="0.00" value={form.intereses} onChange={e => set('intereses', e.target.value)} />
                  </div>
                </div>
              </>
            )}

            <div style={{ marginBottom: 20 }}>
              <label style={labelStyle}>Notas</label>
              <input style={inputStyle} placeholder="Opcional..." value={form.notas} onChange={e => set('notas', e.target.value)} />
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button type="button" style={btnSecondary} onClick={() => setModalOpen(false)}>Cancelar</button>
              <button type="submit" disabled={saving} style={{ ...btnPrimary, opacity: saving ? 0.7 : 1 }}>✓ Guardar ingreso</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
