import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import './EvaluacionCapitulo.css'

// Solo se consultan datos públicos de las preguntas: nunca las claves privadas.
const ID_VALIDO = (id) => typeof id === 'string' && id.length > 0

function respuestaCompleta(pregunta, respuesta) {
  if (!pregunta || !Array.isArray(respuesta)) return false
  if (pregunta.kind === 'multiple_choice') {
    return respuesta.length > 0 && respuesta.every(ID_VALIDO)
  }
  if (pregunta.kind === 'fill_blank') {
    return respuesta.length === 1 && typeof respuesta[0] === 'string' && respuesta[0].trim().length > 0
  }
  if (pregunta.kind === 'ordering') {
    const opciones = Array.isArray(pregunta.options) ? pregunta.options : []
    return opciones.length > 0 && respuesta.length === opciones.length &&
      new Set(respuesta).size === opciones.length &&
      respuesta.every((id) => opciones.some((op) => op.id === id))
  }
  return false
}

export default function EvaluacionCapitulo({ capitulo, onVolver, onAprobado }) {
  const [preguntas, setPreguntas] = useState([])
  const [respuestas, setRespuestas] = useState({})
  const [indice, setIndice] = useState(0)
  const [cargando, setCargando] = useState(true)
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState('')
  const [resultado, setResultado] = useState(null)
  const [notaMinima, setNotaMinima] = useState(null)

  useEffect(() => {
    let activo = true
    async function cargarEvaluacion() {
      setCargando(true)
      setError('')
      setPreguntas([])
      setRespuestas({})
      setIndice(0)
      setResultado(null)
      try {
        const [resultadoPreguntas, resultadoCapitulo] = await Promise.all([
          supabase.from('exercises')
            .select('id,position,kind,prompt,options')
            .eq('chapter_id', capitulo.id)
            .eq('published', true)
            .order('position', { ascending: true }),
          supabase.from('chapters')
            .select('pass_score')
            .eq('id', capitulo.id)
            .single(),
        ])
        if (resultadoPreguntas.error) throw resultadoPreguntas.error
        if (resultadoCapitulo.error) throw resultadoCapitulo.error
        if (activo) {
          setPreguntas(resultadoPreguntas.data ?? [])
          setNotaMinima(resultadoCapitulo.data?.pass_score ?? null)
        }
      } catch (fallo) {
        if (activo) setError(fallo?.message || 'No fue posible consultar las preguntas.')
      } finally {
        if (activo) setCargando(false)
      }
    }
    void cargarEvaluacion()
    return () => { activo = false }
  }, [capitulo.id])

  function registrarRespuesta(id, valor) {
    setRespuestas((previas) => ({ ...previas, [id]: valor }))
    setError('')
  }

  const total = preguntas.length
  const respondidas = preguntas.filter((p) => respuestaCompleta(p, respuestas[p.id])).length
  const pregunta = preguntas[indice]
  const opciones = Array.isArray(pregunta?.options) ? pregunta.options : []
  const respuestaActual = pregunta ? respuestas[pregunta.id] : undefined
  const modoSimple = pregunta?.kind === 'multiple_choice' && opciones.some((op) => op.selection_mode === 'single')
  const secuencia = pregunta?.kind === 'ordering'
    ? (Array.isArray(respuestaActual) && respuestaActual.length === opciones.length
      ? respuestaActual : opciones.map((op) => op.id))
    : []

  function alternarOpcion(id) {
    const previas = Array.isArray(respuestaActual) ? respuestaActual : []
    const siguientes = previas.includes(id)
      ? previas.filter((anterior) => anterior !== id)
      : [...previas, id]
    registrarRespuesta(pregunta.id, siguientes)
  }

  function moverSecuencia(posicion, direccion) {
    const destino = posicion + direccion
    if (destino < 0 || destino >= secuencia.length) return
    const nueva = [...secuencia]
    ;[nueva[posicion], nueva[destino]] = [nueva[destino], nueva[posicion]]
    registrarRespuesta(pregunta.id, nueva)
  }

  async function enviarEvaluacion() {
    if (enviando || total !== 12 || respondidas !== total) return
    setEnviando(true)
    setError('')
    try {
      // El servidor valida sesión, progreso, capítulo, claves privadas y calcula la nota.
      const { data, error: errorEnvio } = await supabase.rpc('centinela_submit_chapter', {
        p_chapter: capitulo.id,
        p_answers: Object.fromEntries(preguntas.map((p) => {
          const respuesta = respuestas[p.id]
          return [p.id, p.kind === 'fill_blank' ? [respuesta[0].trim()] : respuesta]
        })),
      })
      if (errorEnvio) throw errorEnvio
      if (!data || typeof data.score !== 'number' || typeof data.passed !== 'boolean') {
        throw new Error('Supabase no devolvió una calificación válida.')
      }
      setResultado(data)
      if (data.passed) onAprobado?.(capitulo.id)
    } catch (fallo) {
      setError(`No se pudo enviar la evaluación: ${fallo?.message || 'Error desconocido'}`)
    } finally {
      setEnviando(false)
    }
  }

  function reiniciar() {
    setRespuestas({})
    setIndice(0)
    setResultado(null)
    setError('')
  }

  return (
    <section className="cd-examen" aria-label={`Evaluación del capítulo ${capitulo.id}`}>
      <button className="cd-examen-volver" type="button" onClick={onVolver}>
        ← Volver a las enseñanzas
      </button>

      <header className="cd-examen-cabecera">
        <div>
          <span className="cd-examen-sobretitulo">CENTINELA DIGITAL · EVALUACIÓN FINAL</span>
          <h2>Capítulo {String(capitulo.id).padStart(2, '0')}: {capitulo.title}</h2>
          <p>Doce preguntas. La calificación se calcula de forma segura en Supabase.</p>
        </div>
        <div className="cd-examen-nota-minima">Mínimo para aprobar <strong>{notaMinima ?? '—'}/100</strong></div>
      </header>

      {cargando && <div className="cd-examen-panel" role="status">Cargando evaluación desde Supabase...</div>}

      {!cargando && error && !pregunta && <div className="cd-examen-error" role="alert">{error}</div>}

      {!cargando && !resultado && total !== 12 && (
        <div className="cd-examen-panel">
          <h3>Evaluación en preparación</h3>
          <p>Se encontraron {total} de las 12 preguntas requeridas. No es posible rendir la evaluación hasta que estén publicadas todas.</p>
        </div>
      )}

      {!cargando && resultado && (
        <div className="cd-examen-resultado" role="status">
          <div className={resultado.passed ? 'cd-examen-estado-aprobado' : 'cd-examen-estado-pendiente'}>
            {resultado.passed ? '✓ Capítulo aprobado' : 'Evaluación realizada · aún no aprobada'}
          </div>
          <div className="cd-examen-puntuacion">{resultado.score}<span>/100</span></div>
          <p>Respuestas correctas: {resultado.correct} de {resultado.total}. Nota mínima: {resultado.pass_score}/100.</p>
          <p>{resultado.passed
            ? 'Tu resultado quedó registrado. El siguiente capítulo se habilitará en Mi aprendizaje.'
            : 'Tu resultado quedó registrado. Puedes repasar las enseñanzas y realizar otro intento.'}</p>
          <div className="cd-examen-pie-resultado">
            <button type="button" className="cd-examen-secundario" onClick={onVolver}>Volver al capítulo</button>
            {!resultado.passed && <button type="button" className="cd-examen-primario" onClick={reiniciar}>Repetir evaluación</button>}
          </div>
        </div>
      )}

      {!cargando && !resultado && total === 12 && pregunta && (
        <>
          <div className="cd-examen-avance">
            <div className="cd-examen-avance-rotulo">
              <span>Pregunta {indice + 1} de {total}</span>
              <span>{respondidas} respondidas</span>
            </div>
            <div className="cd-examen-progreso" aria-label={`${respondidas} de ${total} preguntas respondidas`}>
              <div style={{ width: `${(respondidas / total) * 100}%` }} />
            </div>
            <nav className="cd-examen-navegacion" aria-label="Navegar por las preguntas">
              {preguntas.map((p, posicion) => (
                <button key={p.id} type="button"
                  className={`${posicion === indice ? 'activa ' : ''}${respuestaCompleta(p, respuestas[p.id]) ? 'respondida' : ''}`}
                  onClick={() => { setIndice(posicion); setError('') }}
                  aria-current={posicion === indice ? 'step' : undefined}
                  aria-label={`Pregunta ${posicion + 1}${respuestaCompleta(p, respuestas[p.id]) ? ' respondida' : ''}`}>
                  {posicion + 1}
                </button>
              ))}
            </nav>
          </div>

          <article className="cd-examen-panel">
            <span className="cd-examen-tipo">
              {pregunta.kind === 'multiple_choice'
                ? (modoSimple ? 'SELECCIÓN SIMPLE' : 'SELECCIÓN MÚLTIPLE')
                : pregunta.kind === 'fill_blank'
                  ? 'COMPLETAR CONCEPTO'
                  : pregunta.kind === 'ordering'
                    ? 'ORDENAR SECUENCIA'
                    : 'EJERCICIO'}
            </span>
            <h3>{pregunta.prompt}</h3>
            {pregunta.kind === 'multiple_choice' && (
              <div className="cd-examen-opciones" role="group" aria-label="Opciones de respuesta">
                {!modoSimple && <p className="cd-examen-ayuda">Marca todas las opciones que consideres correctas.</p>}
                {opciones.map((op) => {
                  const seleccionada = Array.isArray(respuestaActual) && respuestaActual.includes(op.id)
                  return (
                    <label className={`cd-examen-opcion ${seleccionada ? 'elegida' : ''}`} key={op.id}>
                      <input type={modoSimple ? 'radio' : 'checkbox'}
                        name={`respuesta-${pregunta.id}`}
                        checked={Boolean(seleccionada)}
                        onChange={() => modoSimple
                          ? registrarRespuesta(pregunta.id, [op.id])
                          : alternarOpcion(op.id)} />
                      <strong>{op.id}</strong><span>{op.text}</span>
                    </label>
                  )
                })}
              </div>
            )}
            {pregunta.kind === 'fill_blank' && (
              <div className="cd-examen-completar">
                <label htmlFor={`completar-${pregunta.id}`}>Escribe la palabra que falta</label>
                <input id={`completar-${pregunta.id}`} type="text" autoComplete="off" maxLength={120}
                  placeholder="Tu respuesta" value={Array.isArray(respuestaActual) ? respuestaActual[0] : ''}
                  onChange={(evento) => registrarRespuesta(pregunta.id, [evento.target.value])} />
              </div>
            )}
            {pregunta.kind === 'ordering' && (
              <div className="cd-examen-ordenar">
                <p className="cd-examen-ayuda">Coloca las acciones en el orden que consideres correcto.</p>
                {secuencia.map((id, posicion) => {
                  const op = opciones.find((elemento) => elemento.id === id)
                  return (
                    <div className="cd-examen-paso" key={id}>
                      <span className="cd-examen-paso-numero">{posicion + 1}</span>
                      <span className="cd-examen-paso-texto">{op?.text || id}</span>
                      <button type="button" onClick={() => moverSecuencia(posicion, -1)}
                        disabled={posicion === 0} aria-label={`Subir: ${op?.text || id}`} title="Subir">↑</button>
                      <button type="button" onClick={() => moverSecuencia(posicion, 1)}
                        disabled={posicion === secuencia.length - 1}
                        aria-label={`Bajar: ${op?.text || id}`} title="Bajar">↓</button>
                    </div>
                  )
                })}
                <button className="cd-examen-confirmar-orden" type="button"
                  onClick={() => registrarRespuesta(pregunta.id, secuencia)}>
                  Confirmar este orden
                </button>
              </div>
            )}

            {error && <div className="cd-examen-error" role="alert">{error}</div>}

            <footer className="cd-examen-acciones">
              <button className="cd-examen-secundario" type="button" disabled={indice === 0 || enviando}
                onClick={() => setIndice((actual) => Math.max(0, actual - 1))}>← Anterior</button>
              <span>{indice + 1} / {total}</span>
              <button className="cd-examen-primario" type="button" disabled={indice === total - 1 || enviando}
                onClick={() => setIndice((actual) => Math.min(total - 1, actual + 1))}>Siguiente →</button>
            </footer>
          </article>

          <div className="cd-examen-final">
            <p>{respondidas === total
              ? 'Ya respondiste todas las preguntas. Puedes enviar tu evaluación.'
              : `Faltan ${total - respondidas} preguntas por responder.`}</p>
            <button className="cd-examen-enviar" type="button"
              disabled={enviando || respondidas !== total}
              onClick={() => void enviarEvaluacion()}>
              {enviando ? 'Enviando respuestas...' : 'Finalizar y enviar evaluación'}
            </button>
          </div>
        </>
      )}
    </section>
  )
}
