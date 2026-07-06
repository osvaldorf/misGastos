import { useEffect, useState, useCallback } from 'react'
import { getGastos, getGastosResumen, createGasto, updateGasto, deleteGasto } from '../api/gastos'
import { getCategorias, getCuentas, getDestinatarios } from '../api/catalogos'
import { card, inputStyle, labelStyle, btnPrimary, btnSecondary, btnDanger, Modal, ErrorBox, fmtMoney, currentMonthRange, today } from '../components/ui'

const emptyForm = { descripcion: '', monto: '', moneda: 'MXN', fecha: today(), categoria_id: '', cuenta_id: '', destinatario_id: '', notas: '' }

export default function Gastos() {
  const [gastos, setGastos] = useState([])
  const [resumen, setResumen] = useState(null)
  const [categorias, setCategorias] = useState([])
  const [cuentas, setCuentas] = useState([])
  const [destinatarios, setDestinatarios] = useState([])
  const [filtros, setFiltros] = useState({ categoria_id: '', dest_id: '', cuenta_id: '', ...currentMonthRange() })
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)

  const cuentasGasto = cuentas.filter(c => c.opera_gastos !== 0)

  const cargar = useCallback(() => {
    const params = {}
    if (filtros.categoria_id) params.categoria_id = filtros.categoria_id
    if (filtros.dest_id) params.dest_id = filtros.dest_id
    if (filtros.cuenta_id) params.cuenta_id = filtros.cuenta_id
    if (filtros.fecha_ini) params.fecha_ini = filtros.fecha_ini
    if (filtros.fecha_fin) params.fecha_fin = filtros.fecha_fin
    getGastos(params).then(r => setGastos(r.data)).catch(() => {})
    getGastosResumen(params).then(r => setResumen(r.data)).catch(() => {})
  }, [filtros])

  useEffect(() => { cargar() }, [cargar])
  useEffect(() => {
    getCategorias().then(r => setCategorias(r.data)).catch(() => {})
    getCuentas().then(r => setCuentas(r.data)).catch(() => {})
    getDestinatarios().then(r => setDestinatarios(r.data)).catch(() => {})
  }, [])

  const openNuevo = () => { setEditing(null); setForm(emptyForm); setError(null); setModalOpen(true) }
  const openEditar = g => {
    setEditing(g)
    setForm({
      descripcion: g.descripcion, monto: g.monto, moneda: g.moneda,
      fecha: g.fecha?.slice(0, 10), categoria_id: findIdByNombre(categorias, g.categoria),
      cuenta_id: findIdByNombre(cuentas, g.cuenta), destinatario_id: g.destinatario ? findIdByNombre(destinatarios, g.destinatario) : '',
      notas: g.notas || ''
    })
    setError(null); setModalOpen(true)
  }
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const submit = async e => {
    e.preventDefault()
    if (!form.descripcion || !form.monto || !form.categoria_id || !form.cuenta_id) {
      setError('Completa descripción, monto, categoría y cuenta'); return
    }
    setSaving(true); setError(null)
    const body = {
      descripcion: form.descripcion, monto: Number(form.monto), moneda: form.moneda,
      fecha: form.fecha, categoria_id: Number(form.categoria_id), cuenta_id: Number(form.cuenta_id),
      destinatario_id: form.destinatario_id ? Number(form.destinatario_id) : null, notas: form.notas
    }
    try {
      if (editing) await updateGasto(editing.id, body)
      else await createGasto(body)
      setModalOpen(false); cargar()
    } catch (e) {
      setError(e.response?.data?.detail || 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  const eliminar = async id => {
    if (!confirm('¿Eliminar este gasto?')) return
    await deleteGasto(id); cargar()
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>💸 Gastos</h1>
        <button style={btnPrimary} onClick={openNuevo}>+ Nuevo gasto</button>
      </div>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
        <select style={{ ...inputStyle, width: 'auto' }} value={filtros.categoria_id} onChange={e => setFiltros(f => ({ ...f, categoria_id: e.target.value }))}>
          <option value="">Todas las categorías</option>
          {categorias.map(c => <option key={c.id} value={c.id}>{c.emoji} {c.nombre}</option>)}
        </select>
        <select style={{ ...inputStyle, width: 'auto' }} value={filtros.dest_id} onChange={e => setFiltros(f => ({ ...f, dest_id: e.target.value }))}>
          <option value="">Todos los destinatarios</option>
          {destinatarios.map(d => <option key={d.id} value={d.id}>{d.emoji} {d.nombre}</option>)}
        </select>
        <select style={{ ...inputStyle, width: 'auto' }} value={filtros.cuenta_id} onChange={e => setFiltros(f => ({ ...f, cuenta_id: e.target.value }))}>
          <option value="">Todas las cuentas</option>
          {cuentas.map(c => <option key={c.id} value={c.id}>{c.nombre} ({c.banco})</option>)}
        </select>
        <input type="date" style={{ ...inputStyle, width: 'auto' }} value={filtros.fecha_ini} onChange={e => setFiltros(f => ({ ...f, fecha_ini: e.target.value }))} />
        <input type="date" style={{ ...inputStyle, width: 'auto' }} value={filtros.fecha_fin} onChange={e => setFiltros(f => ({ ...f, fecha_fin: e.target.value }))} />
      </div>

      {resumen && (
        <div style={{ marginBottom: 12, fontSize: 14, color: '#374151' }}>
          <b>{resumen.total_registros}</b> gastos &nbsp; Total filtrado: <b style={{ color: '#DC2626' }}>{fmtMoney(resumen.total_mxn)}</b> &nbsp;
          <span style={{ color: '#9ca3af' }}>Mostrando {gastos.length} registros</span>
        </div>
      )}

      <div style={card}>
        {gastos.length === 0 ? (
          <div style={{ color: '#9ca3af', textAlign: 'center', padding: '2rem 0' }}>Sin gastos registrados</div>
        ) : gastos.map((g, i) => (
          <div key={g.id} onClick={() => openEditar(g)} style={{
            display: 'flex', alignItems: 'center', gap: 14, padding: '14px 0', cursor: 'pointer',
            borderTop: i === 0 ? 'none' : '1px solid #f3f4f6'
          }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: (g.cat_color || '#888') + '22', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>
              {g.cat_emoji || '📦'}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: 14.5 }}>{g.descripcion}</div>
              <div style={{ fontSize: 12.5, color: '#9ca3af', display: 'flex', gap: 8, marginTop: 2 }}>
                <span>{g.categoria}</span>
                <span>{g.cuenta}</span>
                {g.destinatario && <span>{g.destinatario}</span>}
                <span>{g.fecha?.slice(0, 10)}</span>
              </div>
            </div>
            <div style={{ fontWeight: 700, color: '#DC2626' }}>{fmtMoney(g.monto, g.moneda)}</div>
            <button style={btnDanger} onClick={e => { e.stopPropagation(); eliminar(g.id) }}>Eliminar</button>
          </div>
        ))}
      </div>

      {modalOpen && (
        <Modal title={editing ? 'Editar gasto' : 'Nuevo gasto'} onClose={() => setModalOpen(false)}>
          <form onSubmit={submit}>
            <ErrorBox>{error}</ErrorBox>
            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>Descripción *</label>
              <input style={inputStyle} placeholder="¿En qué gastaste?" value={form.descripcion} onChange={e => set('descripcion', e.target.value)} autoFocus />
            </div>
            <div style={{ display: 'flex', gap: 12, marginBottom: 14 }}>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Monto *</label>
                <input style={inputStyle} type="number" step="0.01" placeholder="0.00" value={form.monto} onChange={e => set('monto', e.target.value)} />
              </div>
              <div style={{ width: 140 }}>
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
                <label style={labelStyle}>Categoría *</label>
                <select style={inputStyle} value={form.categoria_id} onChange={e => set('categoria_id', e.target.value)}>
                  <option value="">— Selecciona —</option>
                  {categorias.map(c => <option key={c.id} value={c.id}>{c.emoji} {c.nombre}</option>)}
                </select>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 12, marginBottom: 14 }}>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Cuenta *</label>
                <select style={inputStyle} value={form.cuenta_id} onChange={e => set('cuenta_id', e.target.value)}>
                  <option value="">— Selecciona —</option>
                  {cuentasGasto.map(c => <option key={c.id} value={c.id}>{c.nombre} {c.banco ? `(${c.banco})` : ''}</option>)}
                </select>
              </div>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Destinatario</label>
                <select style={inputStyle} value={form.destinatario_id} onChange={e => set('destinatario_id', e.target.value)}>
                  <option value="">— Opcional —</option>
                  {destinatarios.map(d => <option key={d.id} value={d.id}>{d.emoji} {d.nombre}</option>)}
                </select>
              </div>
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={labelStyle}>Notas</label>
              <input style={inputStyle} placeholder="Opcional..." value={form.notas} onChange={e => set('notas', e.target.value)} />
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button type="button" style={btnSecondary} onClick={() => setModalOpen(false)}>Cancelar</button>
              <button type="submit" disabled={saving} style={{ ...btnPrimary, opacity: saving ? 0.7 : 1 }}>✓ Guardar gasto</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}

function findIdByNombre(list, nombre) {
  const found = list.find(x => x.nombre === nombre)
  return found ? found.id : ''
}
