import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import CuestionarioTarea from './CuestionarioTarea'
import './TareasFase5.css'

export default function TareasAsignadas() {
  const [tareas, setTareas] = useState([])
  const [seleccion, setSeleccion] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const cargar = useCallback(async () => {
    setCargando(true)
    const { data, error: fallo } = await supabase.rpc('centinela_task_my_assignments')
    if (fallo) setError(fallo.message)
    else { setTareas(data || []); setError('') }
    setCargando(false)
  }, [])
  useEffect(() => { void cargar() }, [cargar])
  if (seleccion) return <CuestionarioTarea assignment={seleccion} onVolver={() => { setSeleccion(null); void cargar() }} />
  return <section className="cd5">
    <div className="cd5-titulo"><span>FASE 5 · PANEL INSTRUIDO</span><h2>Tareas asignadas</h2>
      <p>Responde los cuestionarios A, B y C que tu instructor haya asignado a tus aulas. Se califican automáticamente sobre 100 puntos.</p></div>
    {cargando && <div className="cd5-panel">Consultando tareas...</div>}
    {error && <p className="cd5-error" role="alert">{error}</p>}
    {!cargando && tareas.length === 0 && <div className="cd5-panel">Todavía no tienes cuestionarios asignados. Consulta con tu instructor.</div>}
    <div className="cd5-lista">{tareas.map((t) => {
      const vencida = Boolean(t.due_at && new Date(t.due_at).getTime() < Date.now())
      return <div className="cd5-panel cd5-fila" key={t.id}>
        <div><h3>Cuestionario {t.quiz_code}</h3><small>Aula: {t.classroom_title}</small>
          <small>{t.due_at ? `Fecha límite: ${new Date(t.due_at).toLocaleString('es-BO')}` : 'Sin fecha límite'}</small>
          <span className="cd5-etiqueta">{t.completed ? `Entregado · ${t.score}/100` : vencida ? 'Plazo vencido' : 'Pendiente'}</span>
        </div>
        {!t.completed && !vencida && <button type="button" className="cd5-btn" onClick={() => setSeleccion(t)}>Responder →</button>}
      </div>
    })}</div>
  </section>
}
