import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import './TareasFase5.css'

export default function CalificacionesTareas() {
  const [tareas, setTareas] = useState([])
  const [seleccion, setSeleccion] = useState(null)
  const [notas, setNotas] = useState([])
  const [error, setError] = useState('')
  const [cargando, setCargando] = useState(true)
  const cargar = useCallback(async () => {
    setCargando(true)
    const { data, error: fallo } = await supabase.rpc('centinela_task_instructor_assignments')
    if (fallo) setError(fallo.message)
    else { setTareas(data || []); setError('') }
    setCargando(false)
  }, [])
  useEffect(() => { void cargar() }, [cargar])
  async function verNotas(t) {
    setError('')
    const { data, error: fallo } = await supabase.rpc('centinela_task_instructor_grades', { p_assignment: t.id })
    if (fallo) setError(fallo.message)
    else { setSeleccion(t); setNotas(data || []) }
  }
  return <section className="cd5">
    <div className="cd5-titulo"><span>FASE 5 · PANEL INSTRUCTOR</span><h2>Calificaciones y seguimiento</h2>
      <p>Resultados reales de los cuestionarios A, B y C, calculados en Supabase.</p></div>
    {seleccion && <div className="cd5-panel"><div className="cd5-encabezado">
      <div><h3>Cuestionario {seleccion.quiz_code} · {seleccion.classroom_title}</h3><small>{notas.filter((x) => x.submitted_at).length} de {notas.length} entregas</small></div>
      <button type="button" className="cd5-secundario" onClick={() => { setSeleccion(null); void cargar() }}>← Lista de tareas</button>
    </div><div className="cd5-scroll"><table className="cd5-tabla"><thead><tr><th>N.º</th><th>Integrante</th><th>Calificación</th><th>Entrega</th></tr></thead>
      <tbody>{notas.map((n) => <tr key={n.troop_number}><td>{String(n.troop_number).padStart(2,'0')}</td><td>{n.student_name}</td>
        <td>{n.submitted_at ? `${n.score}/100 (${n.correct_count}/12)` : 'Pendiente'}</td>
        <td>{n.submitted_at ? new Date(n.submitted_at).toLocaleString('es-BO') : '—'}</td></tr>)}</tbody>
    </table></div></div>}
    {!seleccion && <div className="cd5-panel"><div className="cd5-encabezado"><h3>Selecciona una asignación</h3><button type="button" className="cd5-secundario" onClick={() => void cargar()}>Actualizar</button></div>
      {cargando && <p>Cargando calificaciones...</p>}
      {error && <p className="cd5-error" role="alert">{error}</p>}
      {!cargando && tareas.length === 0 && <p>Todavía no hay cuestionarios asignados.</p>}
      <div className="cd5-lista">{tareas.map((t) => <div className="cd5-fila" key={t.id}><div><strong>Cuestionario {t.quiz_code}</strong><small>{t.classroom_title}</small>
        <small>{t.submitted_count}/{t.assigned_count} entregados</small></div><button type="button" className="cd5-btn" onClick={() => void verNotas(t)}>Ver calificaciones →</button></div>)}</div>
    </div>}
    {seleccion && error && <p className="cd5-error" role="alert">{error}</p>}
  </section>
}
