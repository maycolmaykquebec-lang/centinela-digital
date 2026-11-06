import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import './MiAprendizaje.css'
import './MiAprendizajeProgreso.css'
import EvaluacionCapitulo from './EvaluacionCapitulo'

/**
 * Lector de enseñanzas de CENTINELA DIGITAL.
 * - INSTRUCTOR: vista previa, sin registrar avance.
 * - TROPA: guarda una enseñanza al continuar (o finalizar la última).
 * - Supabase valida la sesión, la publicación y el orden mediante RLS + trigger.
 * - No calcula notas ni desbloquea capítulos: esas funciones se desarrollarán después.
 */
export default function MiAprendizaje({ capitulo, esInstructor = false, onVolver, onAprobado }) {
  const [verEvaluacion, setVerEvaluacion] = useState(false)
  const [lecciones, setLecciones] = useState([])
  const [indice, setIndice] = useState(0)
  const [usuarioId, setUsuarioId] = useState(null)
  const [completadas, setCompletadas] = useState(new Set())
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  const [errorProgreso, setErrorProgreso] = useState('')
  const [aviso, setAviso] = useState('')
  const [imagenFallida, setImagenFallida] = useState(false)

  useEffect(() => {
    let activo = true

    async function cargarLeccionesYProgreso() {
      setVerEvaluacion(false)
      setCargando(true)
      setError('')
      setErrorProgreso('')
      setAviso('')
      setLecciones([])
      setCompletadas(new Set())
      setUsuarioId(null)
      setIndice(0)

      try {
        let consulta = supabase
          .from('lessons')
          .select('id,chapter_id,position,title,content,published')
          .eq('chapter_id', capitulo.id)
          .order('position', { ascending: true })

        if (!esInstructor) consulta = consulta.eq('published', true)

        const { data, error: errorConsulta } = await consulta
        if (errorConsulta) throw errorConsulta
        const lista = data ?? []

        if (esInstructor || lista.length === 0) {
          if (activo) setLecciones(lista)
          return
        }

        // El usuario se obtiene de Supabase Auth, no de un campo editable.
        const { data: authData, error: errorAuth } = await supabase.auth.getUser()
        if (errorAuth) throw errorAuth
        const id = authData?.user?.id
        if (!id) throw new Error('Debes iniciar sesión para guardar tu aprendizaje.')

        // Solo consultamos el progreso de las enseñanzas publicadas de este capítulo.
        const { data: avances, error: errorAvances } = await supabase
          .from('lesson_progress')
          .select('lesson_id')
          .eq('user_id', id)
          .in('lesson_id', lista.map((elemento) => elemento.id))

        if (errorAvances) throw errorAvances
        const idsCompletados = new Set((avances ?? []).map((avance) => avance.lesson_id))
        const primeraPendiente = lista.findIndex((elemento) => !idsCompletados.has(elemento.id))

        if (activo) {
          setUsuarioId(id)
          setCompletadas(idsCompletados)
          setLecciones(lista)
          // Reanuda en la primera enseñanza pendiente; si terminó, muestra la última.
          setIndice(primeraPendiente === -1 ? lista.length - 1 : primeraPendiente)
        }
      } catch (fallo) {
        if (activo) setError(fallo?.message || 'No se pudo cargar el aprendizaje.')
      } finally {
        if (activo) setCargando(false)
      }
    }

    void cargarLeccionesYProgreso()
    return () => { activo = false }
  }, [capitulo.id, esInstructor])

  const total = lecciones.length
  const leccion = lecciones[indice]
  const contenido = leccion?.content && typeof leccion.content === 'object'
    ? leccion.content
    : {}
  const imagen = typeof contenido.image_path === 'string' &&
    contenido.image_path.startsWith('/assets/capitulos/')
    ? contenido.image_path
    : ''
  const pasoActual = total ? indice + 1 : 0
  const cantidadCompletada = lecciones.filter((elemento) => completadas.has(elemento.id)).length
  const porcentaje = total
    ? Math.round(((esInstructor ? pasoActual : cantidadCompletada) / total) * 100)
    : 0
  const todasCompletadas = total > 0 && cantidadCompletada === total

  useEffect(() => {
    setImagenFallida(false)
  }, [leccion?.id])

  function puedeAbrir(posicion) {
    if (esInstructor) return true
    if (posicion === 0) return true
    // Evita saltar enseñanzas en la interfaz. El servidor comprueba el orden también.
    return lecciones.slice(0, posicion).every((elemento) => completadas.has(elemento.id))
  }

  function seleccionarEnsenanza(posicion) {
    if (!puedeAbrir(posicion) || guardando) return
    setIndice(posicion)
    setErrorProgreso('')
    setAviso('')
  }

  async function completarYContinuar() {
    if (!leccion || guardando) return

    // El instructor puede recorrer las enseñanzas, pero nunca escribe progreso.
    if (esInstructor) {
      setIndice((actual) => Math.min(total - 1, actual + 1))
      return
    }

    if (!usuarioId) {
      setErrorProgreso('No se pudo identificar tu sesión. Vuelve a iniciar sesión.')
      return
    }

    setGuardando(true)
    setErrorProgreso('')
    setAviso('')

    try {
      if (!completadas.has(leccion.id)) {
        // INSERT (no UPSERT): la tabla no concede UPDATE a TROPA.
        // El trigger de Supabase verifica publicación y secuencia de enseñanzas.
        const { error: errorInsertar } = await supabase
          .from('lesson_progress')
          .insert({ user_id: usuarioId, lesson_id: leccion.id })

        if (errorInsertar) {
          // Si otra pestaña ya guardó este avance, confirmamos el registro real.
          if (errorInsertar.code === '23505') {
            const { data: existe, error: errorConsulta } = await supabase
              .from('lesson_progress')
              .select('lesson_id')
              .eq('user_id', usuarioId)
              .eq('lesson_id', leccion.id)
              .maybeSingle()
            if (errorConsulta || !existe) throw errorInsertar
          } else {
            throw errorInsertar
          }
        }

        setCompletadas((anterior) => new Set([...anterior, leccion.id]))
      }

      if (indice < total - 1) {
        setIndice((actual) => Math.min(total - 1, actual + 1))
        setAviso('Enseñanza completada. Tu avance se guardó en Supabase.')
      } else {
        setAviso('¡Terminaste las cinco enseñanzas! Tu progreso se guardó. La evaluación se incorporará en el siguiente paso.')
      }
    } catch (fallo) {
      setErrorProgreso(`No se pudo guardar el avance: ${fallo?.message || 'Error desconocido'}`)
    } finally {
      setGuardando(false)
    }
  }

  if (verEvaluacion && !esInstructor && todasCompletadas) {
    return (
      <EvaluacionCapitulo
        capitulo={capitulo}
        onVolver={() => setVerEvaluacion(false)}
        onAprobado={onAprobado}
      />
    )
  }

  return (
    <section className="cd-aprendizaje" aria-label="Contenido del capítulo">
      <button className="cd-aprendizaje-volver" type="button" onClick={onVolver}>
        ← Volver a los nueve capítulos
      </button>

      <div className="cd-aprendizaje-portada">
        <div>
          <span className="cd-aprendizaje-etiqueta">
            {esInstructor ? 'CONTENIDO EDUCATIVO · VISTA DEL INSTRUCTOR' : 'MI APRENDIZAJE · PANEL TROPA'}
          </span>
          <h2>Capítulo {String(capitulo.id).padStart(2, '0')}: {capitulo.title}</h2>
          <p>{capitulo.summary || 'Aprendizaje para la formación del Centinela de la Salud.'}</p>
        </div>
        <span className="cd-aprendizaje-contador">{total} enseñanzas</span>
      </div>

      {cargando && (
        <div className="cd-aprendizaje-mensaje" role="status">
          Consultando enseñanzas y progreso en Supabase...
        </div>
      )}

      {!cargando && error && (
        <div className="cd-aprendizaje-error" role="alert">
          <strong>No fue posible cargar el aprendizaje.</strong>
          <p>{error}</p>
          <p>Comprueba la sesión y los permisos de lectura de Supabase.</p>
        </div>
      )}

      {!cargando && !error && total === 0 && (
        <div className="cd-aprendizaje-mensaje" role="status">
          <strong>{esInstructor ? 'No hay enseñanzas visibles para esta cuenta.' : 'Este capítulo todavía está en preparación.'}</strong>
          <p>
            {esInstructor
              ? 'Comprueba si existen lecciones y si RLS permite ver los borradores.'
              : 'Las enseñanzas aún no están publicadas. Podrás estudiarlas cuando estén disponibles.'}
          </p>
        </div>
      )}

      {!cargando && !error && leccion && (
        <>
          <div className="cd-aprendizaje-barra-superior">
            <span>Enseñanza {pasoActual} de {total}</span>
            <span>
              {esInstructor
                ? 'Vista previa · no registra progreso'
                : `Progreso guardado: ${cantidadCompletada} de ${total} (${porcentaje} %)`}
            </span>
          </div>
          <div
            className="cd-aprendizaje-barra"
            role="progressbar"
            aria-label={esInstructor ? 'Posición de lectura' : 'Enseñanzas completadas'}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={porcentaje}
          >
            <div style={{ width: `${porcentaje}%` }} />
          </div>

          <nav className="cd-aprendizaje-pasos" aria-label="Seleccionar enseñanza">
            {lecciones.map((elemento, posicion) => {
              const terminada = !esInstructor && completadas.has(elemento.id)
              const permitida = puedeAbrir(posicion)
              return (
                <button
                  key={elemento.id}
                  type="button"
                  onClick={() => seleccionarEnsenanza(posicion)}
                  className={[
                    posicion === indice ? 'activo' : '',
                    terminada ? 'cd-progreso-completado' : '',
                  ].filter(Boolean).join(' ')}
                  disabled={!permitida || guardando}
                  aria-current={posicion === indice ? 'step' : undefined}
                  aria-label={`Enseñanza ${posicion + 1}: ${elemento.title}${terminada ? ', completada' : ''}${!permitida ? ', bloqueada' : ''}`}
                  title={permitida ? elemento.title : 'Completa la enseñanza anterior'}
                >
                  {terminada ? '✓' : posicion + 1}
                </button>
              )
            })}
          </nav>

          <article className="cd-aprendizaje-leccion">
            <div className="cd-aprendizaje-leccion-cabecera">
              <div>
                <span className="cd-aprendizaje-etiqueta">ENSEÑANZA {pasoActual} / {total}</span>
                <h3>{leccion.title}</h3>
              </div>
              {esInstructor ? (
                <span className={leccion.published ? 'cd-aprendizaje-publicada' : 'cd-aprendizaje-borrador'}>
                  {leccion.published ? 'Publicada' : 'Borrador'}
                </span>
              ) : completadas.has(leccion.id) ? (
                <span className="cd-progreso-etiqueta">✓ Completada</span>
              ) : null}
            </div>

            <div className="cd-aprendizaje-imagen-marco">
              {imagen && !imagenFallida ? (
                <img
                  key={imagen}
                  src={imagen}
                  alt={`Material visual: ${leccion.title}`}
                  loading="lazy"
                  onError={() => setImagenFallida(true)}
                />
              ) : (
                <p className="cd-aprendizaje-imagen-vacia">
                  Imagen no disponible. Verifica el archivo JPG y la ruta image_path.
                </p>
              )}
            </div>

            <h4>Explicación</h4>
            <p className="cd-aprendizaje-explicacion">
              {contenido.body || 'Esta enseñanza aún no tiene una explicación registrada.'}
            </p>

            {contenido.takeaway && (
              <aside className="cd-aprendizaje-recuerda">
                <strong>Para recordar</strong>
                <p>{contenido.takeaway}</p>
              </aside>
            )}

            {errorProgreso && (
              <p className="cd-progreso-error" role="alert">{errorProgreso}</p>
            )}
            {aviso && (
              <p className="cd-progreso-aviso" role="status">{aviso}</p>
            )}

            <div className="cd-aprendizaje-acciones">
              <button
                type="button"
                className="cd-aprendizaje-anterior"
                onClick={() => seleccionarEnsenanza(Math.max(0, indice - 1))}
                disabled={indice === 0 || guardando}
              >
                ← Anterior
              </button>
              <span>{pasoActual} / {total}</span>
              {esInstructor ? (
                <button
                  type="button"
                  className="cd-aprendizaje-siguiente"
                  onClick={() => seleccionarEnsenanza(Math.min(total - 1, indice + 1))}
                  disabled={indice === total - 1}
                >
                  Siguiente →
                </button>
              ) : (
                <button
                  type="button"
                  className="cd-aprendizaje-siguiente"
                  onClick={() => void completarYContinuar()}
                  disabled={guardando}
                >
                  {guardando
                    ? 'Guardando...'
                    : indice === total - 1
                      ? (todasCompletadas ? 'Enseñanzas completadas ✓' : 'Finalizar y guardar ✓')
                      : (completadas.has(leccion.id) ? 'Siguiente →' : 'Guardar y continuar →')}
                </button>
              )}
            </div>
          </article>

          {!esInstructor && todasCompletadas && (
            <section className="cd-evaluacion-invitacion" aria-label="Evaluación del capítulo">
              <div>
                <strong>¡Terminaste las cinco enseñanzas!</strong>
                <p>Ahora puedes rendir la evaluación de 12 preguntas. La nota se calculará en Supabase sobre 100 puntos.</p>
              </div>
              <button type="button" onClick={() => setVerEvaluacion(true)}>
                Comenzar evaluación →
              </button>
            </section>
          )}

          <p className="cd-aprendizaje-nota">
            {esInstructor
              ? 'Esta vista permite preparar las clases. No guarda progreso ni genera calificaciones.'
              : 'El avance se registra al pulsar «Guardar y continuar» o «Finalizar y guardar». Puedes cerrar sesión y retomar la primera enseñanza pendiente. Al completar las enseñanzas, se habilita la evaluación del capítulo.'}
          </p>
        </>
      )}
    </section>
  )
}
