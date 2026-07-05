import { useEffect, useState, useCallback } from 'react'
import { getUsuariosAdmin } from '../api/admin'
import { card, inputStyle, btnSecondary } from '../components/ui'

const ONLINE_THRESHOLD_MIN = 10

function fmtFecha(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleString('es-MX', { day: '2-digit', month: '2-digit', year: '2-digit', hour: 'numeric', minute: '2-digit', hour12: true })
}

function isOnline(iso) {
  if (!iso) return false
  return (Date.now() - new Date(iso).getTime()) / 60000 < ONLINE_THRESHOLD_MIN
}

export default function Admin() {
  const [usuarios, setUsuarios] = useState([])
  const [pingMin, setPingMin] = useState(Number(localStorage.getItem('pingMin')) || 5)

  const cargar = useCallback(() => {
    getUsuariosAdmin().then(r => setUsuarios(r.data)).catch(() => {})
  }, [])

  useEffect(() => { cargar() }, [cargar])

  const changePing = v => {
    setPingMin(v)
    localStorage.setItem('pingMin', v)
  }

  return (
    <div>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 20 }}>🛡️ Administración</h1>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <span style={{ fontSize: 14, color: '#374151' }}>Ping cada</span>
        <select style={{ ...inputStyle, width: 'auto' }} value={pingMin} onChange={e => changePing(Number(e.target.value))}>
          {[1, 2, 5, 10, 15, 30].map(m => <option key={m} value={m}>{m} min</option>)}
        </select>
        <button style={btnSecondary} onClick={cargar}>🔄 Actualizar</button>
      </div>

      <div style={card}>
        <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 16 }}>👥 Usuarios ({usuarios.length})</div>
        {usuarios.map((u, i) => {
          const online = isOnline(u.ultimo_seen)
          return (
            <div key={u.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderTop: i === 0 ? 'none' : '1px solid #f3f4f6' }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: 14.5 }}>{u.nombre}</div>
                <div style={{ fontSize: 12.5, color: '#9ca3af' }}>{u.email}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: online ? '#1D9E75' : '#9ca3af' }}>
                  {online ? '🟢 En línea' : '⚫ Desconectado'}
                </div>
                <div style={{ fontSize: 12, color: '#9ca3af' }}>{u.total_sesiones} sesión{u.total_sesiones === 1 ? '' : 'es'}</div>
                <div style={{ fontSize: 11.5, color: '#9ca3af' }}>🕐 Último login: {fmtFecha(u.ultimo_login)}</div>
                <div style={{ fontSize: 11.5, color: '#9ca3af' }}>👁 Último seen: {fmtFecha(u.ultimo_seen)}</div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
