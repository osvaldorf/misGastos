import { useEffect, useState, useCallback } from 'react'
import { getTarjetas, getTarjetasResumen, createTarjeta, updateTarjeta, deleteTarjeta, getEstados, upsertEstado } from '../api/tarjetas'
import { getCuentas } from '../api/catalogos'
import { card, inputStyle, labelStyle, btnPrimary, btnSecondary, btnDanger, Modal, ErrorBox, fmtMoney } from '../components/ui'

const emptyTarjeta = { cuenta_id: '', limite_credito: '', dia_corte: '', dias_para_pago: 20, tasa_anual: '' }
const emptyEstado = {
  anio: new Date().getFullYear(), mes: new Date().getMonth() + 1, fecha_corte: '', fecha_limite: '',
  adeudo_anterior: 0, cargos_regulares: 0, cargos_meses: 0, intereses: 0, comisiones: 0, iva: 0,
  pago_minimo: 0, pago_pngi: 0, pago_real: '', tasa: '', notas: ''
}

export default function Tarjetas() {
  const [tarjetas, setTarjetas] = useState([])
  const [resumen, setResumen] = useState(null)
  const [cuentas, setCuentas] = useState([])
  const [modalTarjeta, setModalTarjeta] = useState(false)
  const [editing, setEditing] = useState(null)
  const [formT, setFormT] = useState(emptyTarjeta)
  const [modalEstado, setModalEstado] = useState(null)
  const [formE, setFormE] = useState(emptyEstado)
  const [historial, setHistorial] = useState(null)
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)

  const cargar = useCallback(() => {
    getTarjetas().then(r => setTarjetas(r.data)).catch(() => {})
    getTarjetasResumen().then(r => setResumen(r.data)).catch(() => {})
  }, [])

  useEffect(() => { cargar() }, [cargar])
  useEffect(() => { getCuentas().then(r => setCuentas(r.data)).catch(() => {}) }, [])

  const setT = (k, v) => setFormT(f => ({ ...f, [k]: v }))
  const setE = (k, v) => setFormE(f => ({ ...f, [k]: v }))

  const openNuevaTarjeta = () => { setEditing(null); setFormT(emptyTarjeta); setError(null); setModalTarjeta(true) }
  const openEditarTarjeta = t => {
    setEditing(t)
    setFormT({ cuenta_id: t.cuenta_id, limite_credito: t.limite_credito, dia_corte: t.dia_corte || '', dias_para_pago: t.dias_para_pago, tasa_anual: t.tasa_anual || '' })
    setError(null); setModalTarjeta(true)
  }

  const submitTarjeta = async e => {
    e.preventDefault()
    if (!formT.cuenta_id || !formT.limite_credito) { setError('Selecciona la cuenta y el límite de crédito'); return }
    setSaving(true); setError(null)
    const body = {
      cuenta_id: Number(formT.cuenta_id), limite_credito: Number(formT.limite_credito),
      dia_corte: formT.dia_corte ? Number(formT.dia_corte) : null,
      dias_para_pago: Number(formT.dias_para_pago || 20),
      tasa_anual: formT.tasa_anual ? Number(formT.tasa_anual) : null
    }
    try {
      if (editing) await updateTarjeta(editing.id, body)
      else await createTarjeta(body)
      setModalTarjeta(false); cargar()
    } catch (e) {
      setError(e.response?.data?.detail || 'Error al guardar')
    } finally { setSaving(false) }
  }

  const eliminarTarjeta = async id => {
    if (!confirm('¿Eliminar esta tarjeta?')) return
    await deleteTarjeta(id); cargar()
  }

  const openCapturarEstado = t => {
    setModalEstado(t)
    setFormE({ ...emptyEstado, anio: t.ultimo_anio || new Date().getFullYear(), mes: t.ultimo_mes || new Date().getMonth() + 1 })
    setError(null)
  }

  const submitEstado = async e => {
    e.preventDefault()
    setSaving(true); setError(null)
    const body = {
      ...formE,
      anio: Number(formE.anio), mes: Number(formE.mes),
      fecha_corte: formE.fecha_corte || null, fecha_limite: formE.fecha_limite || null,
      adeudo_anterior: Number(formE.adeudo_anterior || 0), cargos_regulares: Number(formE.cargos_regulares || 0),
      cargos_meses: Number(formE.cargos_meses || 0), intereses: Number(formE.intereses || 0),
      comisiones: Number(formE.comisiones || 0), iva: Number(formE.iva || 0),
      pago_minimo: Number(formE.pago_minimo || 0), pago_pngi: Number(formE.pago_pngi || 0),
      pago_real: formE.pago_real ? Number(formE.pago_real) : null,
      tasa: formE.tasa ? Number(formE.tasa) : null,
    }
    try {
      await upsertEstado(modalEstado.id, body)
      setModalEstado(null); cargar()
    } catch (e) {
      setError(e.response?.data?.detail || 'Error al guardar estado')
    } finally { setSaving(false) }
  }

  const verHistorial = t => {
    setHistorial({ tarjeta: t, estados: null })
    getEstados(t.id).then(r => setHistorial({ tarjeta: t, estados: r.data })).catch(() => setHistorial({ tarjeta: t, estados: [] }))
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>💳 Tarjetas de crédito</h1>
        <button style={btnPrimary} onClick={openNuevaTarjeta}>+ Nueva tarjeta</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 20 }}>
        <div style={card}>
          <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 6 }}>Deuda total</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#DC2626' }}>{fmtMoney(resumen?.deuda_total)}</div>
        </div>
        <div style={card}>
          <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 6 }}>Utilización</div>
          <div style={{ fontSize: 22, fontWeight: 700 }}>{resumen?.utilizacion_pct || 0}%</div>
          <div style={{ fontSize: 12, color: '#9ca3af' }}>de {fmtMoney(resumen?.limite_total)} disponibles</div>
        </div>
        <div style={card}>
          <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 6 }}>Próx. vencimiento</div>
          <div style={{ fontSize: 22, fontWeight: 700 }}>{resumen?.prox_vcto ? resumen.prox_vcto.slice(0, 10) : '—'}</div>
        </div>
        <div style={card}>
          <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 6 }}>Tarjetas activas</div>
          <div style={{ fontSize: 22, fontWeight: 700 }}>{resumen?.total_tarjetas ?? tarjetas.length}</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
        {tarjetas.map(t => {
          const pct = t.limite_credito ? Math.round((t.deudor_total / t.limite_credito) * 100) : 0
          return (
            <div key={t.id} style={card}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 16 }}>{t.cuenta_nombre}</div>
                  <div style={{ fontSize: 13, color: '#9ca3af' }}>{t.banco}</div>
                  <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>
                    {t.ultimo_anio ? `Último corte: ${mesNombre(t.ultimo_mes)} ${t.ultimo_anio}` : 'Sin capturas'}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button style={btnSecondary} onClick={() => openEditarTarjeta(t)}>Editar</button>
                  <button style={btnDanger} onClick={() => eliminarTarjeta(t.id)}>Eliminar</button>
                </div>
              </div>

              <div style={{ marginTop: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, color: '#6b7280', marginBottom: 4 }}>
                  <span>Saldo actual</span>
                  <span>{pct}%</span>
                </div>
                <div style={{ height: 8, borderRadius: 4, background: '#f3f4f6', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${Math.min(pct, 100)}%`, background: pct > 80 ? '#DC2626' : '#1D9E75' }} />
                </div>
                <div style={{ fontSize: 13, color: '#374151', marginTop: 6 }}>
                  {fmtMoney(t.deudor_total)} de {fmtMoney(t.limite_credito)} límite
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 12, fontSize: 12.5 }}>
                <div><span style={{ color: '#9ca3af' }}>Regular: </span><b>{fmtMoney(t.saldo_regular)}</b></div>
                <div><span style={{ color: '#9ca3af' }}>MSI: </span><b>{fmtMoney(t.saldo_meses)}</b></div>
                <div><span style={{ color: '#9ca3af' }}>📅 Vcto: </span><b>{t.fecha_limite ? t.fecha_limite.slice(0, 10) : '—'}</b></div>
                <div><span style={{ color: '#9ca3af' }}>💚 PNGI: </span><b>{fmtMoney(t.pago_pngi)}</b></div>
                <div><span style={{ color: '#9ca3af' }}>✂️ Corte día: </span><b>{t.dia_corte || '—'}</b></div>
                <div><span style={{ color: '#9ca3af' }}>📈 Tasa: </span><b>{t.tasa_anual ? `${t.tasa_anual}%` : '—'}</b></div>
              </div>

              <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
                <button style={{ ...btnPrimary, flex: 1 }} onClick={() => openCapturarEstado(t)}>📋 Capturar estado</button>
                <button style={btnSecondary} onClick={() => verHistorial(t)}>📊</button>
              </div>
            </div>
          )
        })}
      </div>

      {modalTarjeta && (
        <Modal title={editing ? 'Editar tarjeta' : 'Nueva tarjeta'} onClose={() => setModalTarjeta(false)}>
          <form onSubmit={submitTarjeta}>
            <ErrorBox>{error}</ErrorBox>
            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>Cuenta *</label>
              <select style={inputStyle} value={formT.cuenta_id} onChange={e => setT('cuenta_id', e.target.value)} disabled={!!editing}>
                <option value="">— Selecciona —</option>
                {cuentas.map(c => <option key={c.id} value={c.id}>{c.nombre} ({c.banco})</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', gap: 12, marginBottom: 14 }}>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Límite de crédito *</label>
                <input style={inputStyle} type="number" step="0.01" value={formT.limite_credito} onChange={e => setT('limite_credito', e.target.value)} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Tasa anual (%)</label>
                <input style={inputStyle} type="number" step="0.01" value={formT.tasa_anual} onChange={e => setT('tasa_anual', e.target.value)} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Día de corte</label>
                <input style={inputStyle} type="number" min="1" max="31" value={formT.dia_corte} onChange={e => setT('dia_corte', e.target.value)} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Días para pago</label>
                <input style={inputStyle} type="number" value={formT.dias_para_pago} onChange={e => setT('dias_para_pago', e.target.value)} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button type="button" style={btnSecondary} onClick={() => setModalTarjeta(false)}>Cancelar</button>
              <button type="submit" disabled={saving} style={{ ...btnPrimary, opacity: saving ? 0.7 : 1 }}>✓ Guardar</button>
            </div>
          </form>
        </Modal>
      )}

      {modalEstado && (
        <Modal title={`Capturar estado — ${modalEstado.cuenta_nombre}`} onClose={() => setModalEstado(null)} width={560}>
          <form onSubmit={submitEstado}>
            <ErrorBox>{error}</ErrorBox>
            <div style={{ display: 'flex', gap: 12, marginBottom: 14 }}>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Año *</label>
                <input style={inputStyle} type="number" value={formE.anio} onChange={e => setE('anio', e.target.value)} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Mes *</label>
                <input style={inputStyle} type="number" min="1" max="12" value={formE.mes} onChange={e => setE('mes', e.target.value)} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Fecha corte</label>
                <input style={inputStyle} type="date" value={formE.fecha_corte} onChange={e => setE('fecha_corte', e.target.value)} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Fecha límite pago</label>
                <input style={inputStyle} type="date" value={formE.fecha_limite} onChange={e => setE('fecha_limite', e.target.value)} />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 14 }}>
              {[
                ['adeudo_anterior', 'Adeudo anterior'], ['cargos_regulares', 'Cargos regulares'], ['cargos_meses', 'Cargos a MSI'],
                ['intereses', 'Intereses'], ['comisiones', 'Comisiones'], ['iva', 'IVA'],
                ['pago_minimo', 'Pago mínimo'], ['pago_pngi', 'Pago no genera intereses'], ['pago_real', 'Pago que realizaste'],
              ].map(([k, label]) => (
                <div key={k}>
                  <label style={labelStyle}>{label}</label>
                  <input style={inputStyle} type="number" step="0.01" value={formE[k]} onChange={e => setE(k, e.target.value)} />
                </div>
              ))}
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={labelStyle}>Notas</label>
              <input style={inputStyle} value={formE.notas} onChange={e => setE('notas', e.target.value)} />
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button type="button" style={btnSecondary} onClick={() => setModalEstado(null)}>Cancelar</button>
              <button type="submit" disabled={saving} style={{ ...btnPrimary, opacity: saving ? 0.7 : 1 }}>✓ Guardar estado</button>
            </div>
          </form>
        </Modal>
      )}

      {historial && (
        <Modal title={`Historial — ${historial.tarjeta.cuenta_nombre}`} onClose={() => setHistorial(null)} width={600}>
          {historial.estados === null ? (
            <div style={{ color: '#9ca3af', textAlign: 'center', padding: '2rem 0' }}>Cargando...</div>
          ) : historial.estados.length === 0 ? (
            <div style={{ color: '#9ca3af', textAlign: 'center', padding: '2rem 0' }}>Sin estados capturados</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 400, overflowY: 'auto' }}>
              {historial.estados.map((e, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderTop: i === 0 ? 'none' : '1px solid #f3f4f6' }}>
                  <span>{mesNombre(e.mes)} {e.anio}</span>
                  <span style={{ fontWeight: 600 }}>{fmtMoney(e.deudor_total)}</span>
                </div>
              ))}
            </div>
          )}
        </Modal>
      )}
    </div>
  )
}

function mesNombre(m) {
  const meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
  return meses[(m || 1) - 1]
}
