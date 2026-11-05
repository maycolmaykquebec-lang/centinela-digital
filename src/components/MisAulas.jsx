import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import './MisAulas.css'
import NominaAula from './NominaAula'

const CAMPOS_INICIALES = {
  title: '',
  large_unit: '',
  small_unit: '',
  company: '',
}

export default function MisAulas({ instructorId }) {
  const [campos, setCampos] = useState(CAMPOS_INICIALES)
  const [aulas, setAulas] = useState([])
  const [cantidades, setCantidades] = useState({})
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  const [resultado, setResultado] = useState(null)
  const [aviso, setAviso] = useState('')
  const [nominaAbierta, setNominaAbierta] = useState(null)

  const cargarAulas = useCallback(async () => {
    if (!instructorId) return
    setCargando(true)
    setError('')
    try {
      // La política RLS solo permite leer las aulas autorizadas del instructor.
      const { data, error: errorAulas } = await supabase
        .from('classrooms')
        .select('id,title,code,large_unit,small_unit,company,active,created_at')
        .eq('instructor_id', instructorId)
        .order('created_at', { ascending: false })

      if (errorAulas) throw errorAulas
      const lista = data ?? []
      setAulas(lista)

      // Conteo real; no se inventan integrantes cuando todavía no hay inscripciones.
      if (lista.length === 0) {
        setCantidades({})
      } else {
        const { data: miembros, error: errorMiembros } = await supabase
          .from('classroom_members')
          .select('classroom_id')
          .in('classroom_id', lista.map((aula) => aula.id))

        if (errorMiembros) throw errorMiembros
        const nuevosConteos = {}
        for (const aula of lista) nuevosConteos[aula.id] = 0
        for (const miembro of miembros ?? []) {
          nuevosConteos[miembro.classroom_id] = (nuevosConteos[miembro.classroom_id] ?? 0) + 1
        }
        setCantidades(nuevosConteos)
      }
    } catch (fallo) {
      setError(`No se pudieron cargar las aulas: ${fallo.message ?? 'Error desconocido'}`)
    } finally {
      setCargando(false)
    }
  }, [instructorId])

  useEffect(() => {
    void cargarAulas()
  }, [cargarAulas])

  function cambiarCampo(evento) {
    const { name, value } = evento.target
    setCampos((anterior) => ({ ...anterior, [name]: value }))
    setResultado(null)
    setAviso('')
  }

  async function crearAula(evento) {
    evento.preventDefault()
    if (guardando) return
    setError('')
    setAviso('')
    setResultado(null)

    const title = campos.title.trim()
    if (title.length < 3) {
      setError('El nombre del aula debe tener al menos 3 caracteres.')
      return
    }

    setGuardando(true)
    try {
      // El servidor identifica al instructor con auth.uid(), verifica que esté
      // aprobado y genera un código único. No enviamos instructor_id desde React.
      const { data, error: errorCreacion } = await supabase.rpc('centinela_create_classroom', {
        p_title: title,
        p_large_unit: campos.large_unit.trim(),
        p_small_unit: campos.small_unit.trim(),
        p_company: campos.company.trim(),
      })
      if (errorCreacion) throw errorCreacion
      if (!data?.classroom_id || !data?.code) {
        throw new Error('Supabase no devolvió el código del aula.')
      }

      setResultado(data)
      setCampos(CAMPOS_INICIALES)
      setAviso('Aula creada correctamente. Comparte el código solo con los marineros que deban inscribirse.')
      await cargarAulas()
    } catch (fallo) {
      setError(`No se pudo crear el aula: ${fallo.message ?? 'Error desconocido'}`)
    } finally {
      setGuardando(false)
    }
  }

  async function copiarCodigo(codigo) {
    try {
      await navigator.clipboard.writeText(codigo)
      setAviso(`Código ${codigo} copiado al portapapeles.`)
    } catch {
      setAviso(`Selecciona y copia manualmente este código: ${codigo}`)
    }
  }

  return (
    <section className="cd-aulas" aria-label="Gestión de mis aulas">
      <div className="cd-aulas-cabecera">
        <div>
          <span className="cd-aulas-etiqueta">PANEL INSTRUCTOR</span>
          <h2>Mis aulas</h2>
          <p>Crea aulas institucionales, consulta sus códigos y revisa los marineros inscritos.</p>
        </div>
        <button className="cd-aulas-refrescar" type="button" onClick={() => void cargarAulas()} disabled={cargando}>
          {cargando ? 'Actualizando...' : '↻ Actualizar aulas'}
        </button>
      </div>

      <div className="cd-aulas-formulario">
        <h3>Crear nueva aula</h3>
        <p>Completa los datos de la unidad. Supabase generará el código de acceso.</p>
        <form onSubmit={crearAula}>
          <div className="cd-aulas-campos">
            <label className="cd-aulas-campo cd-aulas-campo-ancho">
              <span>Nombre del aula *</span>
              <input name="title" value={campos.title} onChange={cambiarCampo}
                placeholder="Ej.: Instrucción sanitaria — Compañía A" minLength={3} maxLength={120} required />
            </label>
            <label className="cd-aulas-campo">
              <span>Gran Unidad</span>
              <input name="large_unit" value={campos.large_unit} onChange={cambiarCampo}
                placeholder="Nombre de la Gran Unidad" maxLength={150} />
            </label>
            <label className="cd-aulas-campo">
              <span>Pequeña Unidad</span>
              <input name="small_unit" value={campos.small_unit} onChange={cambiarCampo}
                placeholder="Nombre de la Pequeña Unidad" maxLength={150} />
            </label>
            <label className="cd-aulas-campo">
              <span>Compañía</span>
              <input name="company" value={campos.company} onChange={cambiarCampo}
                placeholder="Ej.: A" maxLength={100} />
            </label>
          </div>
          <button className="cd-aulas-crear" type="submit" disabled={guardando}>
            {guardando ? 'Creando aula...' : '+ Crear aula'}
          </button>
        </form>
        {resultado && (
          <div className="cd-aulas-exito" role="status">
            <strong>¡Aula creada! Código de acceso: <code>{resultado.code}</code></strong>
            <button type="button" onClick={() => void copiarCodigo(resultado.code)}>Copiar código</button>
          </div>
        )}
        {aviso && <p className="cd-aulas-mensaje" role="status">{aviso}</p>}
        {error && <p className="cd-aulas-error" role="alert">{error}</p>}
      </div>

      <div className="cd-aulas-listado">
        <div className="cd-aulas-subtitulo">
          <h3>Aulas registradas</h3>
          <span>{aulas.length} {aulas.length === 1 ? 'aula' : 'aulas'}</span>
        </div>
        {cargando ? (
          <p className="cd-aulas-vacio">Consultando las aulas en Supabase...</p>
        ) : aulas.length === 0 ? (
          <p className="cd-aulas-vacio">Todavía no tienes aulas creadas. Utiliza el formulario anterior para registrar la primera.</p>
        ) : (
          <div className="cd-aulas-tarjetas">
            {aulas.map((aula) => (
              <article className="cd-aulas-tarjeta" key={aula.id}>
                <div className="cd-aulas-tarjeta-cabecera">
                  <h4>{aula.title}</h4>
                  <span className={aula.active ? 'cd-aulas-activa' : 'cd-aulas-inactiva'}>
                    {aula.active ? 'Activa' : 'Inactiva'}
                  </span>
                </div>
                <p><b>Gran Unidad:</b> {aula.large_unit || '—'}</p>
                <p><b>Pequeña Unidad:</b> {aula.small_unit || '—'}</p>
                <p><b>Compañía:</b> {aula.company || '—'}</p>
                <div className="cd-aulas-codigo">
                  <span>Código para la TROPA</span>
                  <strong>{aula.code}</strong>
                  <button type="button" onClick={() => void copiarCodigo(aula.code)}>Copiar</button>
                </div>
                <p className="cd-aulas-inscritos">
                  <b>Marineros inscritos:</b> {cantidades[aula.id] ?? '—'} / 81
                </p>
                <button
                  type="button"
                  className="cd-aulas-ver-nomina"
                  aria-expanded={nominaAbierta === aula.id}
                  onClick={() => setNominaAbierta((actual) => actual === aula.id ? null : aula.id)}
                >
                  {nominaAbierta === aula.id ? 'Ocultar nómina' : 'Ver nómina'}
                </button>
              </article>
            ))}
          </div>
        )}
        {nominaAbierta && aulas.some((aula) => aula.id === nominaAbierta) && (
          <NominaAula
            aulaId={nominaAbierta}
            titulo={aulas.find((aula) => aula.id === nominaAbierta)?.title || 'Aula'}
            onCerrar={() => setNominaAbierta(null)}
          />
        )}
        <div className="cd-aviso">Comparte el código únicamente con la TROPA autorizada. La nómina muestra solo los marineros que Supabase permite consultar en tus aulas.</div>
      </div>
    </section>
  )
}
