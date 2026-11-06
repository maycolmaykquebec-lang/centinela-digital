import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import './TareasFase5.css'

const CODIGOS = ['A', 'B', 'C']

export default function GestionTareas() {
  const [aulas, setAulas] = useState([])
  const [tareas, setTareas] = useState([])
  const [aula, setAula] = useState('')
  const [cuestionario, setCuestionario] = useState('A')
  const [fecha, setFecha] = useState('')
  const [cargando, setCargando] = useState(true)
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState('')
  const [mensaje, setMensaje] = useState('')

  const cargar = useCallback(async () => {
    setCargando(true)
    setError('')
    const [rAulas, rTareas] = await Promise.all([
      supabase.rpc('centinela_task_my_classrooms'),
      supabase.rpc('centinela_task_instructor_assignments'),
    ])
    if (rAulas.error || rTareas.error) {
      setError(rAulas.error?.message || rTareas.error?.message)
    } else {
      setAulas(rAulas.data || [])
      setTareas(rTareas.data || [])
      setAula((actual) => actual || rAulas.data?.[0]?.id || '')
    }
    setCargando(false)
  }, [])
  useEffect(() => { void cargar() }, [cargar])

  async function asignar(evento) {
    evento.preventDefault()
    if (!aula || enviando) return
    setEnviando(true)
    setError('')
    setMensaje('')
    try {
      const vencimiento = fecha ? new Date(fecha) : null
      if (vencimiento && Number.isNaN(vencimiento.getTime())) throw new Error('Fecha límite inválida.')
      const { error: fallo } = await supabase.rpc('centinela_task_create_assignment', {
        p_classroom: aula,
        p_quiz: cuestionario,
        p_due_at: vencimiento?.toISOString() || null,
      })
      if (fallo) throw fallo
      setMensaje(`Cuestionario ${cuestionario} asignado correctamente al aula.`)
      setFecha('')
      await cargar()
    } catch (fallo) {
      setError(fallo?.message || 'No se pudo asignar el cuestionario.')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <section className="cd5">
      <div className="cd5-titulo"><span>FASE 5 · PANEL INSTRUCTOR</span><h2>Gestión de tareas</h2>
        <p>Solo hay tres cuestionarios prediseñados: A, B y C. Cada uno tiene 12 preguntas y calificación automática.</p>
      </div>
      <div className="cd5-panel cd5-pdf">
        <div><h3>PROGRAMA CENTINELA DE LA SALUD</h3>
<h4 style={{ margin: '4px 0', color: '#173b55' }}>
  TEST DE EVALUACIÓN
</h4>
<p style={{ fontWeight: 600, margin: '4px 0 12px' }}>
  Ministerio de Defensa
</p>
          <p>Documento original de cuatro páginas, con 25 preguntas. Se utiliza en papel y es independiente de los cuestionarios A, B y C.</p>
          <small>Antes de su uso oficial, revisar y aprobar su contenido sanitario.</small>
        </div>
        <a className="cd5-btn" href="/assets/pdfs/test-2026.pdf" target="_blank" rel="noopener noreferrer">Abrir PDF e imprimir ↗</a>
      </div>
      <div className="cd5-panel">
        <h3>Asignar cuestionario al aula</h3>
        {cargando ? <p>Cargando aulas...</p> : <form className="cd5-form" onSubmit={asignar}>
          <label>Aula
            <select required value={aula} onChange={(e) => setAula(e.target.value)}>
              {aulas.length === 0 && <option value="">Primero crea un aula en Mis aulas</option>}
              {aulas.map((x) => <option value={x.id} key={x.id}>{x.title} · {x.code}</option>)}
            </select>
          </label>
          <label>Cuestionario
            <select value={cuestionario} onChange={(e) => setCuestionario(e.target.value)}>
              {CODIGOS.map((c) => <option value={c} key={c}>Cuestionario {c} · 12 preguntas</option>)}
            </select>
          </label>
          <label>Fecha y hora límite (opcional)
            <input type="datetime-local" value={fecha} onChange={(e) => setFecha(e.target.value)} />
          </label>
          <button className="cd5-btn" type="submit" disabled={!aula || enviando}>
            {enviando ? 'Asignando...' : 'Asignar al aula'}
          </button>
        </form>}
        {error && <p role="alert" className="cd5-error">{error}</p>}
        {mensaje && <p role="status" className="cd5-exito">{mensaje}</p>}
      </div>
      <div className="cd5-panel"><div className="cd5-encabezado"><h3>Cuestionarios asignados</h3><button type="button" className="cd5-secundario" onClick={() => void cargar()}>Actualizar</button></div>
        {tareas.length === 0 ? <p>Actualmente no hay cuestionarios asignados.</p> :
          <div className="cd5-lista">{tareas.map((t) => <div className="cd5-fila" key={t.id}>
            <div><strong>Cuestionario {t.quiz_code}</strong><small>{t.classroom_title}</small>
              <small>Fecha límite: {t.due_at ? new Date(t.due_at).toLocaleString('es-BO') : 'Sin límite'}</small></div>
            <div><span className="cd5-etiqueta">{t.submitted_count}/{t.assigned_count} entregados</span></div>
          </div>)}</div>}
      </div>
    </section>
  )
}
