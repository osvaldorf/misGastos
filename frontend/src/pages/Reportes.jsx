import { useEffect, useState, useCallback } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts'
import { getRollup, getComparar } from '../api/reportes'
import { getGastos } from '../api/gastos'
import { getIngresos } from '../api/ingresos'
import { card, colors, inputStyle, btnSecondary, fmtMoney, PALETTE, currentMonthRange } from '../components/ui'

const DIMENSIONES = {
  gasto:   [{ key: 'categoria', label: 'Categoría' }, { key: 'destinatario', label: 'Persona' }, { key: 'cuenta', label: 'Cuenta' }, { key: 'mes', label: 'Mes' }],
  ingreso: [{ key: 'fuente', label: 'Fuente' }, { key: 'tipo', label: 'Tipo' }, { key: 'cuenta', label: 'Cuenta' }, { key: 'mes', label: 'Mes' }],
}

const SECUENCIA_DRILL = {
  gasto:   ['categoria', 'destinatario', 'mes'],
  ingreso: ['fuente', 'tipo', 'mes'],
}

const FILTRO_POR_DIMENSION = {
  categoria: 'categoria_id',
  destinatario: 'dest_id',
  cuenta: 'cuenta_id',
  fuente: 'fuente_id',
  tipo: 'tipo_ingreso',
}

function mesRange(mesStr) {
  const [y, m] = mesStr.split('-').map(Number)
  const ini = new Date(y, m - 1, 1)
  const fin = new Date(y, m, 0)
  const fmt = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  return { fecha_ini: fmt(ini), fecha_fin: fmt(fin) }
}

// Convierte el breadcrumb acumulado + rango de fechas en los params que aceptan
// /api/reportes/*, /api/gastos y /api/ingresos (mismos nombres que ya usa el resto de la app).
function filtrosDe(breadcrumb, rango) {
  const params = { ...rango }
  for (const crumb of breadcrumb) {
    if (crumb.dimension === 'mes') {
      Object.assign(params, mesRange(crumb.id))
    } else if (crumb.id != null) {
      params[FILTRO_POR_DIMENSION[crumb.dimension]] = crumb.id
    }
  }
  return params
}

function Barra({ data, onClick }) {
  const max = Math.max(1, ...data.map(d => d.total_mxn))
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {data.map((d, i) => (
        <div key={i} onClick={() => onClick?.(d)} style={{ cursor: onClick ? 'pointer' : 'default' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 3 }}>
            <span>{d.emoji ? `${d.emoji} ` : ''}{d.clave}</span>
            <span style={{ fontWeight: 600 }}>{fmtMoney(d.total_mxn)}</span>
          </div>
          <div style={{ background: '#f3f4f6', borderRadius: 6, height: 10 }}>
            <div style={{
              width: `${(d.total_mxn / max) * 100}%`, height: '100%', borderRadius: 6,
              background: d.color || PALETTE[i % PALETTE.length], transition: 'width .2s'
            }} />
          </div>
        </div>
      ))}
    </div>
  )
}

function Detalle({ tipo, filtros }) {
  const [items, setItems] = useState([])
  const filtrosKey = JSON.stringify(filtros)
  useEffect(() => {
    // /api/ingresos espera "tipo", pero reportes usa "tipo_ingreso" para no chocar
    // con el "tipo" (gasto/ingreso) que ya llevan los endpoints de reportes.
    const { tipo_ingreso, ...resto } = filtros
    const params = tipo === 'ingreso' && tipo_ingreso ? { ...resto, tipo: tipo_ingreso } : resto
    const fetcher = tipo === 'gasto' ? getGastos : getIngresos
    fetcher(params).then(r => setItems(r.data)).catch(() => setItems([]))
    // eslint-disable-next-line react-hooks/exhaustive-deps -- filtrosKey ya representa el contenido de filtros
  }, [tipo, filtrosKey])

  return (
    <div style={card}>
      <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 12 }}>Movimientos ({items.length})</div>
      {items.length === 0 ? (
        <div style={{ color: colors.textFaint, textAlign: 'center', padding: '1.5rem 0' }}>Sin movimientos</div>
      ) : items.map((it, i) => (
        <div key={it.id} style={{
          display: 'flex', justifyContent: 'space-between', gap: 12, padding: '10px 0', fontSize: 13.5,
          borderTop: i === 0 ? 'none' : '1px solid #f3f4f6'
        }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 600 }}>{it.descripcion}</div>
            <div style={{ color: colors.textFaint, fontSize: 12 }}>{it.fecha?.slice(0, 10)}</div>
          </div>
          <div style={{ fontWeight: 700, color: tipo === 'gasto' ? colors.danger : colors.accent }}>
            {fmtMoney(it.monto, it.moneda)}
          </div>
        </div>
      ))}
    </div>
  )
}

export default function Reportes() {
  const [tipo, setTipoRaw] = useState('gasto')
  const [rango, setRango] = useState(currentMonthRange())
  const [breadcrumb, setBreadcrumb] = useState([])
  const [agruparPorOverride, setAgruparPorOverride] = useState(null)
  const [rollup, setRollup] = useState([])

  const [comparando, setComparando] = useState(false)
  const [periodoB, setPeriodoB] = useState(currentMonthRange())
  const [comparacion, setComparacion] = useState([])

  const dimensiones = DIMENSIONES[tipo]
  const nivelActual = breadcrumb.length
  const esUltimoNivel = nivelActual >= SECUENCIA_DRILL[tipo].length
  const agruparPor = agruparPorOverride || SECUENCIA_DRILL[tipo][nivelActual] || SECUENCIA_DRILL[tipo][SECUENCIA_DRILL[tipo].length - 1]

  // Cambios de tipo/nivel/comparación son eventos disparados por el usuario, no
  // sincronización con un sistema externo, así que se resuelven aquí mismo en
  // vez de en un useEffect (evita el "cascading render" que marca eslint).
  const setTipo = (nuevo) => {
    setTipoRaw(nuevo)
    setBreadcrumb([])
    setAgruparPorOverride(null)
    setComparando(false)
  }

  const seleccionarDimension = (key) => setAgruparPorOverride(key)

  const drillInto = (fila) => {
    if (esUltimoNivel) return
    setBreadcrumb(b => [...b, { dimension: agruparPor, id: fila.id, label: fila.clave, emoji: fila.emoji }])
    setAgruparPorOverride(null)
  }

  const volverA = (idx) => {
    setBreadcrumb(b => b.slice(0, idx))
    setAgruparPorOverride(null)
  }

  const cargarRollup = useCallback(() => {
    if (!agruparPor || esUltimoNivel) return
    const params = { tipo, agrupar_por: agruparPor, ...filtrosDe(breadcrumb, rango) }
    getRollup(params).then(r => setRollup(r.data)).catch(() => setRollup([]))
  }, [tipo, agruparPor, breadcrumb, rango, esUltimoNivel])

  useEffect(() => { cargarRollup() }, [cargarRollup])

  useEffect(() => {
    if (!comparando || !agruparPor) return
    const filtrosBase = filtrosDe(breadcrumb, {})
    delete filtrosBase.fecha_ini; delete filtrosBase.fecha_fin
    getComparar({
      tipo, agrupar_por: agruparPor,
      periodo_a_ini: rango.fecha_ini, periodo_a_fin: rango.fecha_fin,
      periodo_b_ini: periodoB.fecha_ini, periodo_b_fin: periodoB.fecha_fin,
      ...filtrosBase
    }).then(r => setComparacion(r.data)).catch(() => setComparacion([]))
  }, [comparando, tipo, agruparPor, breadcrumb, rango, periodoB])

  return (
    <div>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 20 }}>📈 Reportes</h1>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16, alignItems: 'center' }}>
        <div style={{ display: 'flex', border: '1px solid #d1d5db', borderRadius: 8, overflow: 'hidden' }}>
          {['gasto', 'ingreso'].map(t => (
            <button key={t} onClick={() => setTipo(t)} style={{
              padding: '8px 16px', border: 'none', cursor: 'pointer', fontSize: 13.5, fontWeight: 600,
              background: tipo === t ? colors.accent : '#fff', color: tipo === t ? '#fff' : colors.text
            }}>
              {t === 'gasto' ? '💸 Gastos' : '💰 Ingresos'}
            </button>
          ))}
        </div>
        <input type="date" style={{ ...inputStyle, width: 'auto' }} value={rango.fecha_ini} onChange={e => setRango(r => ({ ...r, fecha_ini: e.target.value }))} />
        <input type="date" style={{ ...inputStyle, width: 'auto' }} value={rango.fecha_fin} onChange={e => setRango(r => ({ ...r, fecha_fin: e.target.value }))} />
        <button style={btnSecondary} onClick={() => setComparando(c => !c)}>
          {comparando ? '✕ Cerrar comparativa' : '⇄ Comparar períodos'}
        </button>
      </div>

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginBottom: 16 }}>
        <button style={{ ...btnSecondary, padding: '4px 10px', fontSize: 12 }} onClick={() => volverA(0)}>Total</button>
        {breadcrumb.map((c, i) => (
          <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
            <span style={{ color: colors.textFaint }}>›</span>
            <button style={{ ...btnSecondary, padding: '4px 10px', fontSize: 12 }} onClick={() => volverA(i + 1)}>
              {c.emoji ? `${c.emoji} ` : ''}{c.label}
            </button>
          </span>
        ))}
      </div>

      {(comparando || !esUltimoNivel) && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          {dimensiones.map(d => (
            <button key={d.key} onClick={() => seleccionarDimension(d.key)} style={{
              padding: '6px 14px', borderRadius: 20, border: '1px solid #d1d5db', cursor: 'pointer', fontSize: 12.5, fontWeight: 500,
              background: agruparPor === d.key ? colors.accentBg : '#fff',
              color: agruparPor === d.key ? colors.accentText : colors.text
            }}>
              {d.label}
            </button>
          ))}
        </div>
      )}

      {!comparando ? (
        esUltimoNivel ? (
          <Detalle tipo={tipo} filtros={filtrosDe(breadcrumb, rango)} />
        ) : (
          <div style={{ ...card, marginBottom: 20 }}>
            <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 14 }}>
              Por {dimensiones.find(d => d.key === agruparPor)?.label.toLowerCase()}
            </div>
            {rollup.length === 0 ? (
              <div style={{ color: colors.textFaint, textAlign: 'center', padding: '1.5rem 0' }}>Sin datos en este período</div>
            ) : (
              <Barra data={rollup} onClick={drillInto} />
            )}
          </div>
        )
      ) : (
        <div style={card}>
          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>
            Comparativa por {dimensiones.find(d => d.key === agruparPor)?.label.toLowerCase()}
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', margin: '10px 0 16px', fontSize: 13 }}>
            <span style={{ color: colors.textFaint }}>Período A: {rango.fecha_ini} → {rango.fecha_fin}</span>
            <span>vs</span>
            <span>Período B:</span>
            <input type="date" style={{ ...inputStyle, width: 'auto' }} value={periodoB.fecha_ini} onChange={e => setPeriodoB(p => ({ ...p, fecha_ini: e.target.value }))} />
            <input type="date" style={{ ...inputStyle, width: 'auto' }} value={periodoB.fecha_fin} onChange={e => setPeriodoB(p => ({ ...p, fecha_fin: e.target.value }))} />
          </div>
          {comparacion.length === 0 ? (
            <div style={{ color: colors.textFaint, textAlign: 'center', padding: '1.5rem 0' }}>Sin datos para comparar</div>
          ) : (
            <ResponsiveContainer width="100%" height={Math.max(220, comparacion.length * 44)}>
              <BarChart data={comparacion} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f3f4f6" />
                <XAxis type="number" tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="clave" width={140} tick={{ fontSize: 12 }} />
                <Tooltip formatter={v => fmtMoney(v)} />
                <Legend />
                <Bar dataKey="total_a" name="Período A" fill="#9ca3af" radius={[0, 4, 4, 0]} />
                <Bar dataKey="total_b" name="Período B" radius={[0, 4, 4, 0]}>
                  {comparacion.map((d, i) => (
                    <Cell key={i} fill={d.variacion_abs > 0 ? (tipo === 'gasto' ? colors.danger : colors.accent) : (tipo === 'gasto' ? colors.accent : colors.danger)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      )}
    </div>
  )
}
