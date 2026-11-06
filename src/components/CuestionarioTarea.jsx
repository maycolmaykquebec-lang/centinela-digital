import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import './TareasFase5.css'

export default function CuestionarioTarea({ assignment, onVolver }) {
  const [preguntas, setPreguntas] = useState([])
  const [respuestas, setRespuestas] = useState({})
  const [cargando, setCargando] = useState(true)
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState('')
  const [resultado, setResultado] = useState(null)
  useEffect(() => {
    let activo = true
    async function cargar() {
      const { data, error: fallo } = await supabase.rpc('centinela_task_get_questions', { p_assignment: assignment.id })
      if (!activo) return
      setCargando(false)
      if (fallo) setError(fallo.message)
      else setPreguntas(data || [])
    }
    void cargar()
    return () => { activo = false }
  }, [assignment.id])
  const contestadas = useMemo(() => preguntas.filter((p) => Array.isArray(respuestas[p.id]) && respuestas[p.id].length > 0).length, [preguntas, respuestas])
  function responder(id, opt, esMultiple) {
    setRespuestas((prev) => {
      if (!esMultiple) return { ...prev, [id]: [opt] }
      const actual = prev[id] || []
      return { ...prev, [id]: actual.includes(opt) ? actual.filter((x) => x !== opt) : [...actual, opt] }
    })
  }
  async function enviar() {
    if (enviando || preguntas.length !== 12 || contestadas !== 12) return
    setEnviando(true); setError('')
    const { data, error: fallo } = await supabase.rpc('centinela_task_submit', {
      p_assignment: assignment.id, p_answers: respuestas,
    })
    if (fallo) setError(fallo.message)
    else setResultado(data)
    setEnviando(false)
  }
  return <section className="cd5">
    <button type="button" className="cd5-secundario" onClick={onVolver}>← Volver a Tareas asignadas</button>
    <div className="cd5-titulo"><span>CENTINELA DIGITAL · EVALUACIÓN ASIGNADA</span>
      <h2>Cuestionario {assignment.quiz_code}</h2>
      <p>12 preguntas: 4 de selección simple, 4 de selección múltiple y 4 de verdadero/falso. Un solo intento; corrección automática.</p>
    </div>
    {cargando && <div className="cd5-panel">Cargando preguntas...</div>}
    {error && <p role="alert" className="cd5-error">{error}</p>}
    {resultado ? <div className="cd5-panel cd5-resultado" role="status"><h3>Cuestionario entregado correctamente</h3>
      <strong>{resultado.score}/100</strong><p>Aciertos: {resultado.correct} de {resultado.total}.</p>
      <p>La nota está guardada en Supabase y el instructor puede consultarla.</p>
      <button type="button" className="cd5-btn" onClick={onVolver}>Volver a mis tareas</button>
    </div> : <>
      {preguntas.length > 0 && preguntas.length !== 12 && <p className="cd5-error">El cuestionario no está completo. No es posible entregarlo.</p>}
      {preguntas.map((q) => <div className="cd5-panel cd5-pregunta" key={q.id}>
        <div className="cd5-subtitulo">PREGUNTA {q.position}/12 · {q.kind === 'single' ? 'SELECCIÓN SIMPLE' : q.kind === 'multiple' ? 'SELECCIÓN MÚLTIPLE' : 'VERDADERO O FALSO'}</div>
        <h3>{q.prompt}</h3>
        {q.kind === 'multiple' && <small>Marca todas las opciones correctas.</small>}
        <div className="cd5-opciones">{(q.options || []).map((op) => {
          const marcada = (respuestas[q.id] || []).includes(op.id)
          return <label className={`cd5-opcion ${marcada ? 'cd5-marcada' : ''}`} key={op.id}>
            <input type={q.kind === 'multiple' ? 'checkbox' : 'radio'} name={`tarea-${q.id}`}
              checked={marcada} onChange={() => responder(q.id, op.id, q.kind === 'multiple')} />
            <strong>{op.id}</strong><span>{op.text}</span>
          </label>
        })}</div>
      </div>)}
      {preguntas.length === 12 && <div className="cd5-panel cd5-final">
        <p>Preguntas respondidas: <b>{contestadas}/12</b></p>
        <button type="button" className="cd5-btn" disabled={contestadas !== 12 || enviando} onClick={enviar}>
          {enviando ? 'Enviando y calificando...' : 'Entregar cuestionario y obtener nota'}
        </button>
        <small>Al enviar, tus respuestas se registran y no pueden modificarse.</small>
      </div>}
    </>}
  </section>
}
