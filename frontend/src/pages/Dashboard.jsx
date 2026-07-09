import { useEffect, useState } from 'react'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend } from 'recharts'
import { getResumen, getPorCategoria, getPorFuente, getFlujoMensual } from '../api/balance'
import { card, fmtMoney, PALETTE, currentMonthRange, currentYearRange } from '../components/ui'

const MES_ACTUAL_LABEL = new Date().toLocaleDateString('es-MX', { month: 'long', year: 'numeric' })
const ANIO_ACTUAL = new Date().getFullYear()

function StatCard({ label, value, color, sub }) {
  return (
    <div style={card}>
      <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 700, color: color || '#111827' }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 4 }}>{sub}</div>}
    </div>
  )
}

function DonutCard({ title, data, nameKey, valueKey }) {
  const total = data.reduce((s, d) => s + Number(d[valueKey] || 0), 0)
  return (
    <div style={{ ...card, flex: 1, minWidth: 320 }}>
      <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 12 }}>{title}</div>
      {data.length === 0 ? (
        <div style={{ color: '#9ca3af', fontSize: 13, padding: '2rem 0', textAlign: 'center' }}>Sin datos</div>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <ResponsiveContainer width={160} height={160}>
            <PieChart>
              <Pie data={data} dataKey={valueKey} nameKey={nameKey} innerRadius={45} outerRadius={75} paddingAngle={2}>
                {data.map((_, i) => <Cell key={i} fill={data[i].color || PALETTE[i % PALETTE.length]} />)}
              </Pie>
              <Tooltip formatter={v => fmtMoney(v)} />
            </PieChart>
          </ResponsiveContainer>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 180, overflowY: 'auto' }}>
            {data.map((d, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5 }}>
                <span style={{ width: 10, height: 10, borderRadius: 3, background: d.color || PALETTE[i % PALETTE.length], flexShrink: 0 }} />
                <span style={{ flex: 1, color: '#374151' }}>{d.emoji ? `${d.emoji} ` : ''}{d[nameKey]}</span>
                <span style={{ color: '#6b7280' }}>{fmtMoney(d[valueKey])}</span>
                <span style={{ color: '#6b7280', fontWeight: 600, minWidth: 34, textAlign: 'right' }}>{total ? Math.round(d[valueKey] / total * 100) : 0}%</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default function Dashboard() {
  const [resumen, setResumen] = useState(null)
  const [porCategoria, setPorCategoria] = useState([])
  const [porFuente, setPorFuente] = useState([])
  const [porCategoriaMes, setPorCategoriaMes] = useState([])
  const [porFuenteMes, setPorFuenteMes] = useState([])
  const [flujo, setFlujo] = useState([])

  useEffect(() => {
    const rangoAnio = currentYearRange()
    const rangoMes = currentMonthRange()
    getResumen().then(r => setResumen(r.data)).catch(() => {})
    getPorCategoria(rangoAnio).then(r => setPorCategoria(r.data)).catch(() => {})
    getPorFuente(rangoAnio).then(r => setPorFuente(r.data)).catch(() => {})
    getPorCategoria(rangoMes).then(r => setPorCategoriaMes(r.data)).catch(() => {})
    getPorFuente(rangoMes).then(r => setPorFuenteMes(r.data)).catch(() => {})
    getFlujoMensual().then(r => setFlujo(r.data.slice(-6))).catch(() => {})
  }, [])

  return (
    <div>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 20 }}>Dashboard</h1>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 20 }}>
        <StatCard label="Ingresos del mes" value={fmtMoney(resumen?.ingresos_mes_mxn)} color="#1D9E75" />
        <StatCard label="Gastos del mes" value={fmtMoney(resumen?.gastos_mes_mxn)} color="#DC2626" />
        <StatCard label="Flujo neto" value={fmtMoney(resumen?.flujo_neto_mxn)}
          color={(resumen?.flujo_neto_mxn ?? 0) >= 0 ? '#1D9E75' : '#DC2626'} />
        <StatCard label="Saldo préstamos" value={fmtMoney(resumen?.saldo_prestamos_mxn)} color="#8B5CF6"
          sub={resumen ? `${resumen.prestamos_activos} préstamos activos` : ''} />
      </div>

      <div style={{ fontSize: 13, fontWeight: 600, color: '#6b7280', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.4 }}>
        Anual · {ANIO_ACTUAL}
      </div>
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 20 }}>
        <DonutCard title="🍽️ Gastos por categoría" data={porCategoria} nameKey="nombre" valueKey="total_mxn" />
        <DonutCard title="💰 Ingresos por fuente" data={porFuente} nameKey="nombre" valueKey="total_mxn" />
      </div>

      <div style={{ fontSize: 13, fontWeight: 600, color: '#6b7280', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.4 }}>
        Mes actual · {MES_ACTUAL_LABEL}
      </div>
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 20 }}>
        <DonutCard title="🍽️ Gastos por categoría" data={porCategoriaMes} nameKey="nombre" valueKey="total_mxn" />
        <DonutCard title="💰 Ingresos por fuente" data={porFuenteMes} nameKey="nombre" valueKey="total_mxn" />
      </div>

      <div style={card}>
        <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 12 }}>📈 Flujo mensual</div>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={flujo}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
            <XAxis dataKey="mes" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} />
            <Tooltip formatter={v => fmtMoney(v)} />
            <Legend />
            <Bar dataKey="gastos_mxn" name="Gastos" fill="#EF4444" radius={[4, 4, 0, 0]} />
            <Bar dataKey="ingresos_mxn" name="Ingresos" fill="#1D9E75" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
