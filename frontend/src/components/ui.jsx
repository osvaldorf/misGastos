// Primitivas de estilo compartidas entre paginas (mismas convenciones que Login.jsx/Layout.jsx)

export const colors = {
  accent: '#1D9E75',
  accentBg: '#E1F5EE',
  accentText: '#0F6E56',
  text: '#374151',
  textMuted: '#6b7280',
  textFaint: '#9ca3af',
  border: '#e5e7eb',
  bg: '#f5f5f4',
  danger: '#DC2626',
  dangerBg: '#FEF2F2',
  dangerBorder: '#FCA5A5',
}

export const card = {
  background: '#fff', borderRadius: 14, border: '1px solid #e5e7eb',
  padding: '1.25rem', boxSizing: 'border-box'
}

export const inputStyle = {
  width: '100%', padding: '10px 12px', border: '1px solid #d1d5db',
  borderRadius: 8, fontSize: 14, boxSizing: 'border-box',
  fontFamily: 'inherit', outline: 'none'
}

export const labelStyle = {
  display: 'block', fontSize: 13, fontWeight: 500, color: '#374151', marginBottom: 5
}

export const btnPrimary = {
  padding: '10px 16px', background: '#1D9E75', color: '#fff',
  border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer'
}

export const btnSecondary = {
  padding: '10px 16px', background: 'transparent', color: '#374151',
  border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14, fontWeight: 500, cursor: 'pointer'
}

export const btnDanger = {
  padding: '6px 10px', background: 'transparent', color: '#DC2626',
  border: '1px solid #FCA5A5', borderRadius: 6, fontSize: 12, fontWeight: 500, cursor: 'pointer'
}

export function Modal({ title, onClose, children, width = 480 }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
      display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
      padding: '3rem 1rem', zIndex: 1000, overflowY: 'auto'
    }} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{
        background: '#fff', borderRadius: 16, padding: '1.75rem', width: '100%',
        maxWidth: width, boxShadow: '0 10px 40px rgba(0,0,0,0.2)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: '#111827' }}>{title}</h2>
          <button onClick={onClose} style={{
            border: 'none', background: 'transparent', fontSize: 18, cursor: 'pointer', color: '#9ca3af'
          }}>✕</button>
        </div>
        {children}
      </div>
    </div>
  )
}

export function ErrorBox({ children }) {
  if (!children) return null
  return (
    <div style={{
      background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: 8,
      padding: '10px 12px', fontSize: 13, color: '#DC2626', marginBottom: 16
    }}>
      {children}
    </div>
  )
}

export function fmtMoney(n, moneda = 'MXN') {
  const symbol = moneda === 'USD' ? 'US$' : moneda === 'EUR' ? '€' : '$'
  const num = Number(n || 0)
  const sign = num < 0 ? '-' : ''
  return `${sign}${symbol}${Math.abs(num).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export const PALETTE = ['#1D9E75', '#3B82F6', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#14B8A6', '#F97316', '#6366F1', '#84CC16', '#06B6D4', '#A855F7']

function fmtDate(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function currentMonthRange() {
  const now = new Date()
  const first = new Date(now.getFullYear(), now.getMonth(), 1)
  const last = new Date(now.getFullYear(), now.getMonth() + 1, 0)
  return { fecha_ini: fmtDate(first), fecha_fin: fmtDate(last) }
}

export function currentYearRange() {
  const now = new Date()
  const first = new Date(now.getFullYear(), 0, 1)
  const last = new Date(now.getFullYear(), 11, 31)
  return { fecha_ini: fmtDate(first), fecha_fin: fmtDate(last) }
}

export function today() {
  return fmtDate(new Date())
}

// Amortización francesa (cuota fija) — misma fórmula que usa el backend en calcular_amortizacion()
export function calcularCuotaFija(capitalOriginal, tasaInteresAnual, pagosPorAnio, numeroPagos) {
  const capital = Number(capitalOriginal || 0), tasa = Number(tasaInteresAnual || 0)
  const ppa = Number(pagosPorAnio || 0), n = Number(numeroPagos || 0)
  if (!capital || !ppa || !n) return null
  const i = tasa / 100 / ppa
  return i > 0 ? capital * i / (1 - Math.pow(1 + i, -n)) : capital / n
}
