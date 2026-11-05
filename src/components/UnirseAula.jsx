import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import './UnirseAula.css'

const NUMEROS = Array.from({ length: 81 }, (_, indice) => indice + 1)
const formatoNumero = (numero) => String(numero).padStart(2, '0')

export default function UnirseAula({ userId, compacta = false }) {
  const [codigo, setCodigo] = useState('')
  const [numero, setNumero] = useState('')
  const [aulas, setAulas] = useState([])
  const [cargando, setCargando] = useState(true)
  const [enviando, setEnviando] = useState(false)
  const [mensaje, setMensaje] = useState('')
  const [error, setError] = useState('')

  const cargarAulas = useCallback(async () => {
    if (!userId) {
      setAulas([])
      setCargando(false)
      return
    }

    setCargando(true)
    try {
      // RLS: solo muestra inscripciones del propio usuario autenticado.
      const { data, error: fallo } = await supabase
        .from('classroom_members')
        .select('classroom_id,troop_number,joined_at,classrooms(id,title,large_unit,small_unit,company,active)')
        .eq('user_id', userId)
        .order('joined_at', { ascending: false })

      if (fallo) throw fallo
      setAulas(data ?? [])
    } catch (fallo) {
      setError(`No se pudieron consultar tus aulas: ${fallo.message ?? 'Error desconocido'}`)
    } finally {
      setCargando(false)
    }
  }, [userId])

  useEffect(() => {
    void cargarAulas()
  }, [cargarAulas])

  async function inscribirse(evento) {
    evento.preventDefault()
    if (enviando) return
    setMensaje('')
    setError('')

    const codigoLimpio = codigo.trim().toUpperCase()
    const numeroSeleccionado = Number(numero)

    if (!/^[A-F0-9]{8}$/.test(codigoLimpio)) {
      setError('Introduce el código de 8 caracteres que te entregó tu instructor.')
      return
    }
    if (!Number.isInteger(numeroSeleccionado) || numeroSeleccionado < 1 || numeroSeleccionado > 81) {
      setError('Selecciona un número de tropa entre 01 y 81.')
      return
    }

    setEnviando(true)
    try {
      // El servidor valida la cuenta TROPA aprobada, el código, el número y los duplicados.
      // Nunca enviamos user_id, instructor_id ni cambios de calificación desde React.
      const { data, error: fallo } = await supabase.rpc('centinela_join_classroom', {
        p_code: codigoLimpio,
        p_number: numeroSeleccionado,
      })
      if (fallo) throw fallo
      if (!data) throw new Error('Supabase no confirmó la inscripción.')

      setCodigo('')
      setNumero('')
      setMensaje(`¡Inscripción correcta! Tu número de tropa es ${formatoNumero(numeroSeleccionado)}.`)
      await cargarAulas()
    } catch (fallo) {
      setError(`No se pudo realizar la inscripción: ${fallo.message ?? 'Error desconocido'}`)
    } finally {
      setEnviando(false)
    }
  }

  return (
    <section className={`cd-unirse ${compacta ? 'cd-unirse-compacta' : ''}`} aria-label="Inscripción a aulas de TROPA">
      <div className="cd-unirse-encabezado">
        <div>
          <span className="cd-unirse-etiqueta">PANEL TROPA · GESTIÓN DE AULA</span>
          <h2>Mi aula</h2>
          <p>Inscríbete utilizando el código proporcionado por tu instructor y selecciona tu número de tropa.</p>
        </div>
        <button type="button" className="cd-unirse-actualizar" onClick={() => void cargarAulas()} disabled={cargando}>
          {cargando ? 'Consultando...' : '↻ Actualizar'}
        </button>
      </div>

      <div className="cd-unirse-contenido">
        <div className="cd-unirse-inscripciones">
          <h3>{aulas.length > 0 ? 'Mis aulas registradas' : 'Aulas registradas'}</h3>
          {cargando ? (
            <p className="cd-unirse-vacio">Consultando tus inscripciones en Supabase...</p>
          ) : aulas.length === 0 ? (
            <p className="cd-unirse-vacio">Aún no estás inscrito en un aula. Solicita el código de acceso a tu instructor.</p>
          ) : (
            <div className="cd-unirse-lista">
              {aulas.map((registro) => {
                const aula = registro.classrooms
                return (
                  <article key={registro.classroom_id} className="cd-unirse-aula">
                    <div className="cd-unirse-aula-fila">
                      <strong>{aula?.title || 'Aula asignada'}</strong>
                      <span className="cd-unirse-numero">N.º {formatoNumero(registro.troop_number)}</span>
                    </div>
                    <p><b>Gran Unidad:</b> {aula?.large_unit || '—'}</p>
                    <p><b>Pequeña Unidad:</b> {aula?.small_unit || '—'}</p>
                    <p><b>Compañía:</b> {aula?.company || '—'}</p>
                    <span className="cd-unirse-estado">{aula?.active ? 'Aula activa' : 'Aula inactiva'}</span>
                  </article>
                )
              })}
            </div>
          )}
        </div>

        <div className="cd-unirse-formulario">
          <h3>Unirme a un aula</h3>
          <form onSubmit={inscribirse}>
            <label className="cd-unirse-campo">
              <span>Código de acceso *</span>
              <input
                type="text"
                name="codigoAula"
                value={codigo}
                onChange={(evento) => setCodigo(evento.target.value.toUpperCase())}
                placeholder="Ej.: 63E22BC6"
                maxLength={8}
                autoComplete="off"
                spellCheck="false"
                required
              />
            </label>
            <label className="cd-unirse-campo">
              <span>Número de tropa (01–81) *</span>
              <select name="numeroTropa" value={numero} onChange={(evento) => setNumero(evento.target.value)} required>
                <option value="">Selecciona tu número</option>
                {NUMEROS.map((valor) => (
                  <option key={valor} value={valor}>{formatoNumero(valor)}</option>
                ))}
              </select>
            </label>
            <button className="cd-unirse-boton" type="submit" disabled={enviando || !userId}>
              {enviando ? 'Registrando...' : 'Unirme al aula'}
            </button>
          </form>
          <p className="cd-unirse-nota">El instructor debe confirmarte qué número corresponde. Supabase impedirá que dos marineros ocupen el mismo número dentro de un aula.</p>
          {mensaje && <div className="cd-unirse-exito" role="status">{mensaje}</div>}
          {error && <div className="cd-unirse-error" role="alert">{error}</div>}
        </div>
      </div>
    </section>
  )
}
