import { useState } from 'react'
import client from '../api/client'

const TIPOS_PAGO = ['Tarjeta débito', 'Tarjeta crédito', 'Efectivo', 'Transferencia', 'Ahorro', 'Casa de bolsa', 'Crypto', 'Plan de pensión', 'Otros']
const MONEDAS   = ['MXN', 'USD', 'EUR']

const inp = {
  padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: 8,
  fontSize: 14, width: '100%', boxSizing: 'border-box', fontFamily: 'inherit'
}
const lbl = { display: 'block', fontSize: 12, fontWeight: 500, color: '#374151', marginBottom: 4 }

function PasoBienvenida({ nombre, onNext }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: 56, marginBottom: '1rem' }}>👋</div>
      <h2 style={{ fontSize: 22, fontWeight: 700, color: '#111827', marginBottom: 8 }}>
        ¡Hola, {nombre}!
      </h2>
      <p style={{ fontSize: 15, color: '#6b7280', marginBottom: '0.5rem', lineHeight: 1.6 }}>
        Bienvenido a <strong style={{ color: '#1D9E75' }}>Mis Finanzas</strong>.
      </p>
      <p style={{ fontSize: 14, color: '#9ca3af', marginBottom: '2rem', lineHeight: 1.6 }}>
        En 2 pasos rápidos configuramos tus cuentas y estarás listo para empezar.
      </p>
      <button onClick={onNext} style={{
        padding: '13px 32px', background: '#1D9E75', color: '#fff',
        border: 'none', borderRadius: 10, fontSize: 15, fontWeight: 600, cursor: 'pointer'
      }}>
        Comenzar →
      </button>
    </div>
  )
}

function PasoCuentas({ onNext }) {
  const [cuentas, setCuentas] = useState([{ nombre: '', banco: '', tipo_pago: 'Tarjeta débito', moneda: 'MXN' }])
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState(null)

  const setC = (i, k, v) => setCuentas(prev => prev.map((c, idx) => idx === i ? { ...c, [k]: v } : c))

  const agregar = () => setCuentas(prev => [...prev, { nombre: '', banco: '', tipo_pago: 'Tarjeta débito', moneda: 'MXN' }])
  const quitar  = (i) => setCuentas(prev => prev.filter((_, idx) => idx !== i))

  const handleNext = async () => {
    const validas = cuentas.filter(c => c.nombre.trim())
    if (validas.length === 0) { setError('Agrega al menos una cuenta'); return }
    setSaving(true); setError(null)
    try {
      await Promise.all(validas.map(c => client.post('/api/catalogos/cuentas', {
        nombre: c.nombre.trim(), banco: c.banco.trim(),
        tipo_pago: c.tipo_pago, moneda: c.moneda, color: '#1D9E75'
      })))
      onNext()
    } catch (e) {
      setError(e.response?.data?.detail || 'Error al guardar cuentas')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <h2 style={{ fontSize: 20, fontWeight: 700, color: '#111827', marginBottom: 4 }}>
        💳 Tus cuentas
      </h2>
      <p style={{ fontSize: 13, color: '#6b7280', marginBottom: '1.25rem' }}>
        Agrega las cuentas con las que registrarás tus gastos e ingresos.
      </p>

      {cuentas.map((c, i) => (
        <div key={i} style={{ background: '#f9fafb', borderRadius: 10, padding: '12px', marginBottom: 10, border: '1px solid #e5e7eb' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <span style={{ fontSize: 13, fontWeight: 500, color: '#374151' }}>Cuenta {i + 1}</span>
            {cuentas.length > 1 && (
              <button onClick={() => quitar(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: 16 }}>✕</button>
            )}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div style={{ gridColumn: '1/-1' }}>
              <label style={lbl}>Nombre *</label>
              <input style={inp} placeholder="Ej: Débito Banamex"
                value={c.nombre} onChange={e => setC(i, 'nombre', e.target.value)} />
            </div>
            <div>
              <label style={lbl}>Banco</label>
              <input style={inp} placeholder="Ej: Banamex"
                value={c.banco} onChange={e => setC(i, 'banco', e.target.value)} />
            </div>
            <div>
              <label style={lbl}>Tipo</label>
              <select style={inp} value={c.tipo_pago} onChange={e => setC(i, 'tipo_pago', e.target.value)}>
                {TIPOS_PAGO.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label style={lbl}>Moneda</label>
              <select style={inp} value={c.moneda} onChange={e => setC(i, 'moneda', e.target.value)}>
                {MONEDAS.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
          </div>
        </div>
      ))}

      <button onClick={agregar} style={{
        width: '100%', padding: '9px', border: '1px dashed #d1d5db',
        borderRadius: 8, background: '#fff', color: '#6b7280',
        fontSize: 13, cursor: 'pointer', marginBottom: 16
      }}>
        + Agregar otra cuenta
      </button>

      {error && (
        <div style={{ background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: 8, padding: '8px 12px', fontSize: 13, color: '#DC2626', marginBottom: 12 }}>
          {error}
        </div>
      )}

      <button onClick={handleNext} disabled={saving} style={{
        width: '100%', padding: '13px', background: '#1D9E75', color: '#fff',
        border: 'none', borderRadius: 10, fontSize: 15, fontWeight: 600,
        cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1
      }}>
        {saving ? 'Guardando...' : 'Continuar →'}
      </button>
    </div>
  )
}

function PasoListo({ onComplete }) {
  const [loading, setLoading] = useState(false)

  const handleComplete = async () => {
    setLoading(true)
    try {
      await client.post('/api/onboarding/completar')
      onComplete()
    } catch {
      onComplete() // si falla igual completamos
    }
  }

  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: 56, marginBottom: '1rem' }}>🎉</div>
      <h2 style={{ fontSize: 22, fontWeight: 700, color: '#111827', marginBottom: 8 }}>
        ¡Todo listo!
      </h2>
      <p style={{ fontSize: 14, color: '#6b7280', marginBottom: '2rem', lineHeight: 1.6 }}>
        Tus cuentas y categorías están configuradas.<br />
        Ya puedes empezar a registrar tus gastos e ingresos.
      </p>
      <button onClick={handleComplete} disabled={loading} style={{
        padding: '13px 32px', background: '#1D9E75', color: '#fff',
        border: 'none', borderRadius: 10, fontSize: 15, fontWeight: 600,
        cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1
      }}>
        {loading ? 'Entrando...' : 'Ir al Dashboard →'}
      </button>
    </div>
  )
}

export default function Onboarding({ onComplete }) {
  const [paso, setPaso] = useState(0)
  const usuario = JSON.parse(localStorage.getItem('usuario') || '{}')

  const pasos = [
    <PasoBienvenida nombre={usuario.nombre || 'usuario'} onNext={() => setPaso(1)} />,
    <PasoCuentas onNext={() => setPaso(2)} />,
    <PasoListo onComplete={onComplete} />,
  ]

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: '#f5f5f4', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      padding: '1rem'
    }}>
      <div style={{ background: '#fff', borderRadius: 16, padding: '2rem', width: '100%', maxWidth: 460, boxShadow: '0 4px 24px rgba(0,0,0,0.08)' }}>
        {/* Progress */}
        <div style={{ display: 'flex', gap: 6, marginBottom: '1.5rem' }}>
          {[0, 1, 2].map(i => (
            <div key={i} style={{
              flex: 1, height: 4, borderRadius: 2,
              background: i <= paso ? '#1D9E75' : '#e5e7eb',
              transition: 'background .3s'
            }} />
          ))}
        </div>
        {pasos[paso]}
      </div>
    </div>
  )
}
