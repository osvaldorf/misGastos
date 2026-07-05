import { useEffect, useState, useCallback } from 'react'
import {
  getCategorias, createCategoria, updateCategoria, deleteCategoria,
  getCuentas, createCuenta, updateCuenta, deleteCuenta,
  getDestinatarios, createDestinatario, updateDestinatario, deleteDestinatario,
  getFuentes, createFuente, updateFuente, deleteFuente,
  getPrestatarios, createPrestatario, updatePrestatario, deletePrestatario,
  cambiarPassword
} from '../api/catalogos'
import { card, inputStyle, labelStyle, btnPrimary, btnSecondary, btnDanger, Modal, ErrorBox } from '../components/ui'

const TABS = [
  { key: 'cuentas', icon: '💳', label: 'Cuentas' },
  { key: 'categorias', icon: '🏷️', label: 'Categorías' },
  { key: 'destinatarios', icon: '👥', label: 'Destinatarios' },
  { key: 'fuentes', icon: '💰', label: 'Fuentes' },
  { key: 'prestatarios', icon: '🤝', label: 'Prestatarios' },
  { key: 'seguridad', icon: '🔒', label: 'Seguridad' },
]

export default function Config() {
  const [tab, setTab] = useState('cuentas')

  return (
    <div>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 20 }}>⚙️ Configuración</h1>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            padding: '10px 16px', borderRadius: 10, border: '1px solid #e5e7eb', cursor: 'pointer',
            fontSize: 13.5, fontWeight: 600,
            background: tab === t.key ? '#1D9E75' : '#fff',
            color: tab === t.key ? '#fff' : '#374151'
          }}>{t.icon} {t.label}</button>
        ))}
      </div>

      {tab === 'cuentas' && <CuentasTab />}
      {tab === 'categorias' && <SimpleTab title="Mis categorías" nuevoLabel="Nueva categoría"
        list={getCategorias} create={createCategoria} update={updateCategoria} del={deleteCategoria}
        fields={['nombre', 'emoji', 'color']} subtitleFn={() => ''} />}
      {tab === 'destinatarios' && <SimpleTab title="Mis destinatarios" nuevoLabel="Nuevo destinatario"
        list={getDestinatarios} create={createDestinatario} update={updateDestinatario} del={deleteDestinatario}
        fields={['nombre', 'emoji', 'color']} subtitleFn={() => ''} />}
      {tab === 'fuentes' && <FuentesTab />}
      {tab === 'prestatarios' && <PrestatariosTab />}
      {tab === 'seguridad' && <SeguridadTab />}
    </div>
  )
}

function useCatalogo(list) {
  const [items, setItems] = useState([])
  const cargar = useCallback(() => { list().then(r => setItems(r.data)).catch(() => {}) }, [list])
  useEffect(() => { cargar() }, [cargar])
  return [items, cargar]
}

function CuentasTab() {
  const [items, cargar] = useCatalogo(getCuentas)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({ nombre: '', banco: '', tipo_pago: 'Efectivo', moneda: 'MXN', color: '#888780' })
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const openNuevo = () => { setEditing(null); setForm({ nombre: '', banco: '', tipo_pago: 'Efectivo', moneda: 'MXN', color: '#888780' }); setError(null); setModalOpen(true) }
  const openEditar = c => { setEditing(c); setForm({ nombre: c.nombre, banco: c.banco || '', tipo_pago: c.tipo_pago, moneda: c.moneda, color: c.color || '#888780' }); setError(null); setModalOpen(true) }

  const submit = async e => {
    e.preventDefault()
    if (!form.nombre || !form.tipo_pago) { setError('Completa nombre y tipo de pago'); return }
    setSaving(true); setError(null)
    try {
      if (editing) await updateCuenta(editing.id, form)
      else await createCuenta(form)
      setModalOpen(false); cargar()
    } catch (e) { setError(e.response?.data?.detail || 'Error al guardar') } finally { setSaving(false) }
  }
  const eliminar = async id => { if (!confirm('¿Eliminar esta cuenta?')) return; await deleteCuenta(id); cargar() }

  return (
    <div style={card}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ fontWeight: 700, fontSize: 16 }}>Mis cuentas</div>
        <button style={btnPrimary} onClick={openNuevo}>+ Nueva cuenta</button>
      </div>
      {items.map((c, i) => (
        <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderTop: i === 0 ? 'none' : '1px solid #f3f4f6' }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: 14 }}>{c.nombre}{c.banco ? ` — ${c.banco}` : ''}</div>
            <div style={{ fontSize: 12.5, color: '#9ca3af' }}>{c.tipo_pago} · {c.moneda}</div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button style={btnSecondary} onClick={() => openEditar(c)}>✏️ Editar</button>
            <button style={btnDanger} onClick={() => eliminar(c.id)}>🗑</button>
          </div>
        </div>
      ))}

      {modalOpen && (
        <Modal title={editing ? 'Editar cuenta' : 'Nueva cuenta'} onClose={() => setModalOpen(false)}>
          <form onSubmit={submit}>
            <ErrorBox>{error}</ErrorBox>
            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>Nombre *</label>
              <input style={inputStyle} value={form.nombre} onChange={e => set('nombre', e.target.value)} autoFocus />
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>Banco</label>
              <input style={inputStyle} value={form.banco} onChange={e => set('banco', e.target.value)} />
            </div>
            <div style={{ display: 'flex', gap: 12, marginBottom: 14 }}>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Tipo de pago *</label>
                <select style={inputStyle} value={form.tipo_pago} onChange={e => set('tipo_pago', e.target.value)}>
                  {['Efectivo', 'Tarjeta débito', 'Tarjeta crédito', 'Ahorro', 'Casa de bolsa', 'Plan de pensión', 'Crypto', 'CoDi', 'Otros'].map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Moneda</label>
                <select style={inputStyle} value={form.moneda} onChange={e => set('moneda', e.target.value)}>
                  <option value="MXN">MXN</option><option value="USD">USD</option><option value="EUR">EUR</option>
                </select>
              </div>
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={labelStyle}>Color</label>
              <input style={{ ...inputStyle, height: 40, padding: 4 }} type="color" value={form.color} onChange={e => set('color', e.target.value)} />
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

function SimpleTab({ title, nuevoLabel, list, create, update, del, fields }) {
  const [items, cargar] = useCatalogo(list)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const emptyForm = Object.fromEntries(fields.map(f => [f, f === 'emoji' ? '📦' : f === 'color' ? '#888780' : '']))
  const [form, setForm] = useState(emptyForm)
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const openNuevo = () => { setEditing(null); setForm(emptyForm); setError(null); setModalOpen(true) }
  const openEditar = it => { setEditing(it); setForm(Object.fromEntries(fields.map(f => [f, it[f] ?? '']))); setError(null); setModalOpen(true) }

  const submit = async e => {
    e.preventDefault()
    if (!form.nombre) { setError('El nombre es obligatorio'); return }
    setSaving(true); setError(null)
    try {
      if (editing) await update(editing.id, form)
      else await create(form)
      setModalOpen(false); cargar()
    } catch (e) { setError(e.response?.data?.detail || 'Error al guardar') } finally { setSaving(false) }
  }
  const eliminar = async id => { if (!confirm('¿Eliminar?')) return; await del(id); cargar() }

  return (
    <div style={card}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ fontWeight: 700, fontSize: 16 }}>{title}</div>
        <button style={btnPrimary} onClick={openNuevo}>+ {nuevoLabel}</button>
      </div>
      {items.map((it, i) => (
        <div key={it.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderTop: i === 0 ? 'none' : '1px solid #f3f4f6' }}>
          <div style={{ fontWeight: 600, fontSize: 14 }}>{it.emoji ? `${it.emoji} ` : ''}{it.nombre}</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button style={btnSecondary} onClick={() => openEditar(it)}>✏️ Editar</button>
            {!it.es_sistema && <button style={btnDanger} onClick={() => eliminar(it.id)}>🗑</button>}
          </div>
        </div>
      ))}

      {modalOpen && (
        <Modal title={editing ? 'Editar' : nuevoLabel} onClose={() => setModalOpen(false)}>
          <form onSubmit={submit}>
            <ErrorBox>{error}</ErrorBox>
            {fields.includes('nombre') && (
              <div style={{ marginBottom: 14 }}>
                <label style={labelStyle}>Nombre *</label>
                <input style={inputStyle} value={form.nombre} onChange={e => set('nombre', e.target.value)} autoFocus />
              </div>
            )}
            <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
              {fields.includes('emoji') && (
                <div style={{ width: 90 }}>
                  <label style={labelStyle}>Emoji</label>
                  <input style={inputStyle} value={form.emoji} onChange={e => set('emoji', e.target.value)} />
                </div>
              )}
              {fields.includes('color') && (
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Color</label>
                  <input style={{ ...inputStyle, height: 40, padding: 4 }} type="color" value={form.color} onChange={e => set('color', e.target.value)} />
                </div>
              )}
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

function FuentesTab() {
  const [items, cargar] = useCatalogo(getFuentes)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const empty = { nombre: '', tipo: 'Salario', frecuencia: 'Variable', moneda: 'MXN', color: '#1D9E75' }
  const [form, setForm] = useState(empty)
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const openNuevo = () => { setEditing(null); setForm(empty); setError(null); setModalOpen(true) }
  const openEditar = it => { setEditing(it); setForm({ nombre: it.nombre, tipo: it.tipo, frecuencia: it.frecuencia, moneda: it.moneda, color: it.color || '#1D9E75' }); setError(null); setModalOpen(true) }

  const submit = async e => {
    e.preventDefault()
    if (!form.nombre || !form.tipo) { setError('Completa nombre y tipo'); return }
    setSaving(true); setError(null)
    try {
      if (editing) await updateFuente(editing.id, form)
      else await createFuente(form)
      setModalOpen(false); cargar()
    } catch (e) { setError(e.response?.data?.detail || 'Error al guardar') } finally { setSaving(false) }
  }
  const eliminar = async id => { if (!confirm('¿Eliminar?')) return; await deleteFuente(id); cargar() }

  return (
    <div style={card}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ fontWeight: 700, fontSize: 16 }}>Mis fuentes de ingreso</div>
        <button style={btnPrimary} onClick={openNuevo}>+ Nueva fuente</button>
      </div>
      {items.map((it, i) => (
        <div key={it.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderTop: i === 0 ? 'none' : '1px solid #f3f4f6' }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: 14 }}>{it.nombre}</div>
            <div style={{ fontSize: 12.5, color: '#9ca3af' }}>{it.tipo} · {it.frecuencia} · {it.moneda}</div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button style={btnSecondary} onClick={() => openEditar(it)}>✏️ Editar</button>
            <button style={btnDanger} onClick={() => eliminar(it.id)}>🗑</button>
          </div>
        </div>
      ))}

      {modalOpen && (
        <Modal title={editing ? 'Editar fuente' : 'Nueva fuente'} onClose={() => setModalOpen(false)}>
          <form onSubmit={submit}>
            <ErrorBox>{error}</ErrorBox>
            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>Nombre *</label>
              <input style={inputStyle} value={form.nombre} onChange={e => set('nombre', e.target.value)} autoFocus />
            </div>
            <div style={{ display: 'flex', gap: 12, marginBottom: 14 }}>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Tipo *</label>
                <select style={inputStyle} value={form.tipo} onChange={e => set('tipo', e.target.value)}>
                  {['Salario', 'Renta', 'Inversión', 'Préstamo', 'Otro'].map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Frecuencia</label>
                <select style={inputStyle} value={form.frecuencia} onChange={e => set('frecuencia', e.target.value)}>
                  <option value="Fija">Fija</option><option value="Variable">Variable</option>
                </select>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Moneda</label>
                <select style={inputStyle} value={form.moneda} onChange={e => set('moneda', e.target.value)}>
                  <option value="MXN">MXN</option><option value="USD">USD</option><option value="EUR">EUR</option>
                </select>
              </div>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Color</label>
                <input style={{ ...inputStyle, height: 40, padding: 4 }} type="color" value={form.color} onChange={e => set('color', e.target.value)} />
              </div>
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

function PrestatariosTab() {
  const [items, cargar] = useCatalogo(getPrestatarios)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const empty = { nombre: '', capital_original: '', tasa_interes: '', fecha_prestamo: '', fecha_vencimiento: '', notas: '' }
  const [form, setForm] = useState(empty)
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const openNuevo = () => { setEditing(null); setForm(empty); setError(null); setModalOpen(true) }
  const openEditar = it => {
    setEditing(it)
    setForm({ nombre: it.nombre, capital_original: it.capital_original, tasa_interes: it.tasa_interes || '', fecha_prestamo: it.fecha_prestamo?.slice(0, 10) || '', fecha_vencimiento: it.fecha_vencimiento?.slice(0, 10) || '', notas: it.notas || '' })
    setError(null); setModalOpen(true)
  }

  const submit = async e => {
    e.preventDefault()
    if (!form.nombre || !form.capital_original) { setError('Completa nombre y capital'); return }
    setSaving(true); setError(null)
    const body = { ...form, capital_original: Number(form.capital_original), tasa_interes: Number(form.tasa_interes || 0), fecha_prestamo: form.fecha_prestamo || null, fecha_vencimiento: form.fecha_vencimiento || null }
    try {
      if (editing) await updatePrestatario(editing.id, body)
      else await createPrestatario(body)
      setModalOpen(false); cargar()
    } catch (e) { setError(e.response?.data?.detail || 'Error al guardar') } finally { setSaving(false) }
  }
  const eliminar = async id => { if (!confirm('¿Eliminar?')) return; await deletePrestatario(id); cargar() }

  return (
    <div style={card}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ fontWeight: 700, fontSize: 16 }}>Mis prestatarios</div>
        <button style={btnPrimary} onClick={openNuevo}>+ Nuevo prestatario</button>
      </div>
      {items.map((it, i) => (
        <div key={it.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderTop: i === 0 ? 'none' : '1px solid #f3f4f6' }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: 14 }}>{it.nombre}</div>
            <div style={{ fontSize: 12.5, color: '#9ca3af' }}>{it.estatus} · Saldo: ${Number(it.saldo_capital || 0).toLocaleString('es-MX')}</div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button style={btnSecondary} onClick={() => openEditar(it)}>✏️ Editar</button>
            <button style={btnDanger} onClick={() => eliminar(it.id)}>🗑</button>
          </div>
        </div>
      ))}

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
                <label style={labelStyle}>Tasa interés anual (%)</label>
                <input style={inputStyle} type="number" step="0.01" value={form.tasa_interes} onChange={e => set('tasa_interes', e.target.value)} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Fecha préstamo</label>
                <input style={inputStyle} type="date" value={form.fecha_prestamo} onChange={e => set('fecha_prestamo', e.target.value)} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Fecha vencimiento</label>
                <input style={inputStyle} type="date" value={form.fecha_vencimiento} onChange={e => set('fecha_vencimiento', e.target.value)} />
              </div>
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

function SeguridadTab() {
  const [form, setForm] = useState({ password_actual: '', password_nuevo: '' })
  const [error, setError] = useState(null)
  const [ok, setOk] = useState(false)
  const [saving, setSaving] = useState(false)

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const submit = async e => {
    e.preventDefault()
    if (form.password_nuevo.length < 8) { setError('La nueva contraseña debe tener al menos 8 caracteres'); return }
    setSaving(true); setError(null); setOk(false)
    try {
      await cambiarPassword(form)
      setOk(true); setForm({ password_actual: '', password_nuevo: '' })
    } catch (e) { setError(e.response?.data?.detail || 'Error al cambiar contraseña') } finally { setSaving(false) }
  }

  return (
    <div style={{ ...card, maxWidth: 420 }}>
      <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 16 }}>Cambiar contraseña</div>
      <form onSubmit={submit}>
        <ErrorBox>{error}</ErrorBox>
        {ok && <div style={{ background: '#E1F5EE', color: '#0F6E56', padding: '10px 12px', borderRadius: 8, fontSize: 13, marginBottom: 16 }}>Contraseña actualizada correctamente</div>}
        <div style={{ marginBottom: 14 }}>
          <label style={labelStyle}>Contraseña actual</label>
          <input style={inputStyle} type="password" value={form.password_actual} onChange={e => set('password_actual', e.target.value)} />
        </div>
        <div style={{ marginBottom: 20 }}>
          <label style={labelStyle}>Nueva contraseña</label>
          <input style={inputStyle} type="password" value={form.password_nuevo} onChange={e => set('password_nuevo', e.target.value)} />
        </div>
        <button type="submit" disabled={saving} style={{ ...btnPrimary, opacity: saving ? 0.7 : 1, width: '100%' }}>Actualizar contraseña</button>
      </form>
    </div>
  )
}
