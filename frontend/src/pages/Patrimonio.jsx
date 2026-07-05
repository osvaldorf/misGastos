import { useEffect, useState, useCallback, useMemo } from 'react'
import { AreaChart, Area, PieChart, Pie, Cell, Tooltip, ResponsiveContainer, XAxis, YAxis, CartesianGrid, Legend } from 'recharts'
import {
  getPatrimonioCuentas, updateCuentaPatrimonio, getSaldosPeriodo, getSaldosUltimoMes,
  guardarSaldosMes, getPatrimonioResumen, getPatrimonioEvolucion
} from '../api/patrimonio'
import { getCuentas } from '../api/catalogos'
import { card, inputStyle, labelStyle, btnPrimary, btnSecondary, Modal, ErrorBox, fmtMoney } from '../components/ui'

const CATS = [
  { key: 'Liquido', emoji: '💧', label: 'Líquido', color: '#3B82F6' },
  { key: 'Ahorro', emoji: '🏦', label: 'Ahorro', color: '#1D9E75' },
  { key: 'InvCorta', emoji: '📈', label: 'Inv. Corta', color: '#F59E0B' },
  { key: 'InvLarga', emoji: '📊', label: 'Inv. Larga', color: '#8B5CF6' },
  { key: 'Retiro', emoji: '🏖️', label: 'Retiro', color: '#EC4899' },
]
const catInfo = key => CATS.find(c => c.key === key) || { emoji: '📦', label: key, color: '#9ca3af' }

export default function Patrimonio() {
  const [resumen, setResumen] = useState(null)
  const [evolucion, setEvolucion] = useState([])
  const [saldos, setSaldos] = useState([])
  const [patrimonioCuentas, setPatrimonioCuentas] = useState([])
  const [todasCuentas, setTodasCuentas] = useState([])
  const [modalConfig, setModalConfig] = useState(false)
  const [modalCapturar, setModalCapturar] = useState(false)
  const [modalEditarSaldo, setModalEditarSaldo] = useState(null)
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)

  const cargar = useCallback(() => {
    getPatrimonioResumen().then(r => setResumen(r.data)).catch(() => {})
    getPatrimonioEvolucion().then(r => setEvolucion(r.data)).catch(() => {})
    getPatrimonioCuentas().then(r => setPatrimonioCuentas(r.data)).catch(() => {})
  }, [])

  useEffect(() => { cargar() }, [cargar])
  useEffect(() => { getCuentas().then(r => setTodasCuentas(r.data)).catch(() => {}) }, [])

  useEffect(() => {
    if (resumen && !resumen.sin_datos) {
      getSaldosPeriodo(resumen.anio, resumen.mes).then(r => setSaldos(r.data)).catch(() => {})
    }
  }, [resumen])

  const evolucionPivot = useMemo(() => {
    const porPeriodo = {}
    evolucion.forEach(e => {
      if (!porPeriodo[e.periodo]) porPeriodo[e.periodo] = { periodo: e.periodo }
      porPeriodo[e.periodo][e.categoria_liq] = e.total_mxn
    })
    return Object.values(porPeriodo).sort((a, b) => a.periodo.localeCompare(b.periodo))
  }, [evolucion])

  const distribucion = useMemo(() => {
    if (!resumen?.por_categoria) return []
    return Object.entries(resumen.por_categoria).map(([k, v]) => ({ key: k, value: v, ...catInfo(k) }))
  }, [resumen])

  const saldosPorCategoria = useMemo(() => {
    const g = {}
    saldos.forEach(s => {
      const k = s.categoria_liq || 'Otro'
      if (!g[k]) g[k] = []
      g[k].push(s)
    })
    return g
  }, [saldos])

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>💎 Patrimonio</h1>
          {resumen && !resumen.sin_datos && <div style={{ color: '#9ca3af', fontSize: 13, marginTop: 2 }}>Último corte: {mesNombre(resumen.mes)} {resumen.anio}</div>}
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button style={btnSecondary} onClick={() => setModalConfig(true)}>⚙️ Configurar cuentas</button>
          <button style={btnPrimary} onClick={() => setModalCapturar(true)}>📸 Capturar mes</button>
        </div>
      </div>

      {resumen?.sin_datos ? (
        <div style={{ ...card, textAlign: 'center', color: '#9ca3af', padding: '3rem 0' }}>
          Aún no has capturado saldos. Usa "📸 Capturar mes" para empezar.
        </div>
      ) : resumen && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 20 }}>
            <div style={card}>
              <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 6 }}>Patrimonio bruto</div>
              <div style={{ fontSize: 24, fontWeight: 700 }}>${Math.round(resumen.patrimonio_bruto).toLocaleString('es-MX')}</div>
              {resumen.variacion_pct != null && (
                <div style={{ fontSize: 12, color: resumen.variacion_pct >= 0 ? '#1D9E75' : '#DC2626' }}>
                  {resumen.variacion_pct >= 0 ? '+' : ''}{resumen.variacion_pct}% vs mes anterior
                </div>
              )}
            </div>
            {CATS.map(c => {
              const val = resumen.por_categoria?.[c.key] || 0
              const pct = resumen.patrimonio_bruto ? (val / resumen.patrimonio_bruto * 100).toFixed(1) : 0
              return (
                <div key={c.key} style={card}>
                  <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 6 }}>{c.emoji} {c.label}</div>
                  <div style={{ fontSize: 20, fontWeight: 700 }}>${Math.round(val).toLocaleString('es-MX')}</div>
                  <div style={{ fontSize: 12, color: '#9ca3af' }}>{pct}% del total</div>
                </div>
              )
            })}
            <div style={card}>
              <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 6 }}>🤝 Préstamos otorgados</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#8B5CF6' }}>${Math.round(resumen.prestamos_otorgados).toLocaleString('es-MX')}</div>
              <div style={{ fontSize: 12, color: '#9ca3af' }}>Automático de módulo préstamos</div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 20 }}>
            <div style={{ ...card, flex: 2, minWidth: 340 }}>
              <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 12 }}>📈 Evolución patrimonial</div>
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={evolucionPivot}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                  <XAxis dataKey="periodo" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `$${(v / 1e6).toFixed(1)}M`} />
                  <Tooltip formatter={v => fmtMoney(v)} />
                  <Legend />
                  {CATS.map(c => (
                    <Area key={c.key} type="monotone" dataKey={c.key} name={`${c.emoji} ${c.label}`} stackId="1" stroke={c.color} fill={c.color} fillOpacity={0.6} />
                  ))}
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div style={{ ...card, flex: 1, minWidth: 260 }}>
              <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 12 }}>🍩 Distribución</div>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={distribucion} dataKey="value" nameKey="label" innerRadius={50} outerRadius={85} paddingAngle={2}>
                    {distribucion.map((d, i) => <Cell key={i} fill={d.color} />)}
                  </Pie>
                  <Tooltip formatter={v => fmtMoney(v)} />
                </PieChart>
              </ResponsiveContainer>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 10 }}>
                {distribucion.map((d, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5 }}>
                    <span>{d.emoji} {d.label}</span>
                    <span style={{ fontWeight: 600 }}>{fmtMoney(d.value)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div style={card}>
            <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 12 }}>📋 Saldos del período — {mesNombre(resumen.mes)} {resumen.anio}</div>
            {CATS.map(c => {
              const items = saldosPorCategoria[c.key]
              if (!items?.length) return null
              const total = items.reduce((s, i) => s + Number(i.saldo_mxn || 0), 0)
              return (
                <div key={c.key} style={{ marginBottom: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600, fontSize: 14, marginBottom: 8 }}>
                    <span>{c.emoji} {c.label}</span>
                    <span>{fmtMoney(total)}</span>
                  </div>
                  {items.map((s, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderTop: i === 0 ? 'none' : '1px solid #f3f4f6' }}>
                      <div>
                        <div style={{ fontSize: 13.5 }}>{s.cuenta_nombre}</div>
                        <div style={{ fontSize: 12, color: '#9ca3af' }}>{s.moneda !== 'MXN' ? `${s.saldo} ${s.moneda}` : ''}</div>
                      </div>
                      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                        <span style={{ fontWeight: 600 }}>{fmtMoney(s.saldo_mxn)}</span>
                        <button style={btnSecondary} onClick={() => setModalEditarSaldo(s)}>✏️ Editar</button>
                      </div>
                    </div>
                  ))}
                </div>
              )
            })}
          </div>
        </>
      )}

      {modalConfig && (
        <ConfigCuentasModal
          cuentas={todasCuentas}
          onClose={() => setModalConfig(false)}
          onSaved={() => { setModalConfig(false); cargar(); getCuentas().then(r => setTodasCuentas(r.data)) }}
        />
      )}

      {modalCapturar && resumen && (
        <CapturarMesModal
          cuentas={patrimonioCuentas}
          resumen={resumen}
          onClose={() => setModalCapturar(false)}
          onSaved={() => { setModalCapturar(false); cargar() }}
        />
      )}

      {modalEditarSaldo && resumen && (
        <Modal title={`Editar saldo — ${modalEditarSaldo.cuenta_nombre}`} onClose={() => setModalEditarSaldo(null)}>
          <EditarSaldoForm
            saldo={modalEditarSaldo} anio={resumen.anio} mes={resumen.mes}
            onSaved={() => { setModalEditarSaldo(null); cargar() }}
            onClose={() => setModalEditarSaldo(null)}
          />
        </Modal>
      )}
    </div>
  )
}

function EditarSaldoForm({ saldo, anio, mes, onSaved, onClose }) {
  const [val, setVal] = useState(saldo.saldo)
  const [tasa, setTasa] = useState(saldo.tasa_cambio || 1)
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)

  const submit = async e => {
    e.preventDefault()
    setSaving(true); setError(null)
    try {
      await guardarSaldosMes({
        anio, mes,
        saldos: [{ cuenta_id: saldo.cuenta_id, saldo: Number(val), moneda: saldo.moneda, tasa_cambio: Number(tasa), notas: saldo.notas || '' }]
      })
      onSaved()
    } catch (e) {
      setError(e.response?.data?.detail || 'Error al guardar')
    } finally { setSaving(false) }
  }

  return (
    <form onSubmit={submit}>
      <ErrorBox>{error}</ErrorBox>
      <div style={{ marginBottom: 14 }}>
        <label style={labelStyle}>Saldo ({saldo.moneda})</label>
        <input style={inputStyle} type="number" step="0.01" value={val} onChange={e => setVal(e.target.value)} autoFocus />
      </div>
      {saldo.moneda !== 'MXN' && (
        <div style={{ marginBottom: 20 }}>
          <label style={labelStyle}>Tasa de cambio a MXN</label>
          <input style={inputStyle} type="number" step="0.0001" value={tasa} onChange={e => setTasa(e.target.value)} />
        </div>
      )}
      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
        <button type="button" style={btnSecondary} onClick={onClose}>Cancelar</button>
        <button type="submit" disabled={saving} style={{ ...btnPrimary, opacity: saving ? 0.7 : 1 }}>✓ Guardar</button>
      </div>
    </form>
  )
}

function CapturarMesModal({ cuentas, resumen, onClose, onSaved }) {
  const [anio, setAnio] = useState(resumen?.sin_datos ? new Date().getFullYear() : resumen.anio)
  const [mes, setMes] = useState(resumen?.sin_datos ? new Date().getMonth() + 1 : (resumen.mes % 12) + 1)
  const [valores, setValores] = useState({})
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    getSaldosUltimoMes().then(r => {
      const map = {}
      r.data.saldos.forEach(s => { map[s.cuenta_id] = s })
      setValores(map)
    }).catch(() => {})
  }, [])

  const setSaldo = (cuentaId, moneda, val) => {
    setValores(v => ({ ...v, [cuentaId]: { ...(v[cuentaId] || { moneda, tasa_cambio: 1 }), cuenta_id: cuentaId, saldo: val } }))
  }

  const submit = async e => {
    e.preventDefault()
    setSaving(true); setError(null)
    const saldos = cuentas
      .filter(c => valores[c.id]?.saldo !== undefined && valores[c.id]?.saldo !== '')
      .map(c => ({
        cuenta_id: c.id, saldo: Number(valores[c.id].saldo), moneda: c.moneda,
        tasa_cambio: Number(valores[c.id].tasa_cambio || 1), notas: ''
      }))
    try {
      await guardarSaldosMes({ anio: Number(anio), mes: Number(mes), saldos })
      onSaved()
    } catch (e) {
      setError(e.response?.data?.detail || 'Error al guardar')
    } finally { setSaving(false) }
  }

  const porCategoria = {}
  cuentas.forEach(c => { (porCategoria[c.categoria_liq] ||= []).push(c) })

  return (
    <Modal title="📸 Capturar mes" onClose={onClose} width={560}>
      <form onSubmit={submit}>
        <ErrorBox>{error}</ErrorBox>
        <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>Año</label>
            <input style={inputStyle} type="number" value={anio} onChange={e => setAnio(e.target.value)} />
          </div>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>Mes</label>
            <input style={inputStyle} type="number" min="1" max="12" value={mes} onChange={e => setMes(e.target.value)} />
          </div>
        </div>
        <div style={{ maxHeight: 360, overflowY: 'auto', marginBottom: 16 }}>
          {CATS.map(c => porCategoria[c.key]?.length > 0 && (
            <div key={c.key} style={{ marginBottom: 14 }}>
              <div style={{ fontWeight: 600, fontSize: 13.5, marginBottom: 6 }}>{c.emoji} {c.label}</div>
              {porCategoria[c.key].map(cta => (
                <div key={cta.id} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                  <span style={{ flex: 1, fontSize: 13 }}>{cta.nombre} <span style={{ color: '#9ca3af' }}>({cta.moneda})</span></span>
                  <input style={{ ...inputStyle, width: 140 }} type="number" step="0.01" placeholder="0.00"
                    value={valores[cta.id]?.saldo ?? ''} onChange={e => setSaldo(cta.id, cta.moneda, e.target.value)} />
                </div>
              ))}
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button type="button" style={btnSecondary} onClick={onClose}>Cancelar</button>
          <button type="submit" disabled={saving} style={{ ...btnPrimary, opacity: saving ? 0.7 : 1 }}>✓ Guardar mes</button>
        </div>
      </form>
    </Modal>
  )
}

function ConfigCuentasModal({ cuentas, onClose, onSaved }) {
  const [valores, setValores] = useState(() => {
    const map = {}
    cuentas.forEach(c => { map[c.id] = { categoria_liq: c.categoria_liq || '', opera_gastos: c.opera_gastos ?? 1 } })
    return map
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const submit = async e => {
    e.preventDefault()
    setSaving(true); setError(null)
    try {
      await Promise.all(Object.entries(valores)
        .filter(([id, v]) => v.categoria_liq !== (cuentas.find(c => c.id === Number(id))?.categoria_liq || ''))
        .map(([id, v]) => updateCuentaPatrimonio(id, { categoria_liq: v.categoria_liq || null, opera_gastos: v.opera_gastos })))
      onSaved()
    } catch (e) {
      setError(e.response?.data?.detail || 'Error al guardar')
    } finally { setSaving(false) }
  }

  return (
    <Modal title="⚙️ Configurar cuentas" onClose={onClose} width={560}>
      <form onSubmit={submit}>
        <ErrorBox>{error}</ErrorBox>
        <div style={{ maxHeight: 420, overflowY: 'auto', marginBottom: 16 }}>
          {cuentas.map(c => (
            <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderTop: '1px solid #f3f4f6' }}>
              <span style={{ flex: 1, fontSize: 13.5 }}>{c.nombre} <span style={{ color: '#9ca3af' }}>({c.banco})</span></span>
              <select style={{ ...inputStyle, width: 160 }} value={valores[c.id]?.categoria_liq || ''}
                onChange={e => setValores(v => ({ ...v, [c.id]: { ...v[c.id], categoria_liq: e.target.value } }))}>
                <option value="">— Sin categoría —</option>
                {CATS.map(cat => <option key={cat.key} value={cat.key}>{cat.emoji} {cat.label}</option>)}
              </select>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button type="button" style={btnSecondary} onClick={onClose}>Cancelar</button>
          <button type="submit" disabled={saving} style={{ ...btnPrimary, opacity: saving ? 0.7 : 1 }}>✓ Guardar</button>
        </div>
      </form>
    </Modal>
  )
}

function mesNombre(m) {
  const meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
  return meses[(m || 1) - 1]
}
