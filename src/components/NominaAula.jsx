import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import './NominaAula.css'

function mostrarFecha(fecha) {
  if (!fecha) return '—'
  const valor = new Date(fecha)
  if (Number.isNaN(valor.getTime())) return '—'
  return new Intl.DateTimeFormat('es-BO', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  }).format(valor)
}

export default function NominaAula({ aulaId, titulo, onCerrar }) {
  const [filas, setFilas] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [advertencia, setAdvertencia] = useState('')
  const [version, setVersion] = useState(0)

  useEffect(() => {
    let vigente = true

    async function cargarNomina() {
      setCargando(true)
      setError('')
      setAdvertencia('')

      try {
        // RLS debe limitar la lectura a las aulas autorizadas del instructor.
        const { data: miembros, error: errorMiembros } = await supabase
          .from('classroom_members')
          .select('user_id,troop_number,joined_at')
          .eq('classroom_id', aulaId)
          .order('troop_number', { ascending: true })

        if (errorMiembros) throw errorMiembros
        if (!vigente) return

        const inscritos = miembros ?? []
        if (inscritos.length === 0) {
          setFilas([])
          return
        }

        // Se consulta profiles por separado para no depender de una relación
        // PostgREST embebida; profiles_read debe habilitar a los instructores
        // aprobados a leer únicamente los perfiles de sus propios alumnos.
        const ids = [...new Set(inscritos.map((miembro) => miembro.user_id))]
        const { data: perfiles, error: errorPerfiles } = await supabase
          .from('profiles')
          .select('id,first_name,last_name,category,company')
          .in('id', ids)

        if (!vigente) return

        if (errorPerfiles) {
          setAdvertencia('No se pudieron consultar los nombres. Verifica los permisos de lectura de profiles en Supabase.')
        }

        const perfilesPorId = new Map(
          (perfiles ?? []).map((perfil) => [perfil.id, perfil])
        )
        const incompletos = inscritos.some((miembro) => !perfilesPorId.has(miembro.user_id))
        if (!errorPerfiles && incompletos) {
          setAdvertencia('Algunos perfiles no son visibles con los permisos actuales de Supabase. Verifica la política profiles_read.')
        }

        setFilas(inscritos.map((miembro) => ({
          numero: miembro.troop_number,
          fecha: miembro.joined_at,
          perfil: perfilesPorId.get(miembro.user_id) ?? null,
        })))
      } catch (fallo) {
        if (vigente) {
          setError(`No se pudo cargar la nómina: ${fallo.message ?? 'Error desconocido'}`)
          setFilas([])
        }
      } finally {
        if (vigente) setCargando(false)
      }
    }

    void cargarNomina()
    return () => { vigente = false }
  }, [aulaId, version])

  return (
    <section className="cd-nomina" aria-label={`Nómina del aula ${titulo}`}>
      <div className="cd-nomina-cabecera">
        <div>
          <span className="cd-nomina-etiqueta">REGISTRO INSTITUCIONAL</span>
          <h3>Nómina de INSTRUIDO — {titulo}</h3>
          <p>Personal inscrito, ordenado por número de instruido (01 al 81).</p>
        </div>
        <div className="cd-nomina-acciones">
          <button type="button" onClick={() => setVersion((valor) => valor + 1)} disabled={cargando}>
            {cargando ? 'Cargando...' : 'Actualizar nómina'}
          </button>
          <button type="button" onClick={onCerrar}>Cerrar</button>
        </div>
      </div>

      {error && <p className="cd-nomina-error" role="alert">{error}</p>}
      {advertencia && <p className="cd-nomina-advertencia" role="status">{advertencia}</p>}

      {cargando ? (
        <p className="cd-nomina-vacio">Consultando a los marineros inscritos...</p>
      ) : error ? null : filas.length === 0 ? (
        <p className="cd-nomina-vacio">Esta aula todavía no tiene marineros inscritos.</p>
      ) : (
        <>
          <p className="cd-nomina-contador"><strong>{filas.length}</strong> de 81 marineros inscritos.</p>
          <div className="cd-nomina-tabla-scroll">
            <table className="cd-nomina-tabla">
              <thead>
                <tr>
                  <th scope="col">N.º</th>
                  <th scope="col">Nombres y apellidos</th>
                  <th scope="col">Categoría</th>
                  <th scope="col">Compañía</th>
                  <th scope="col">Inscripción</th>
                </tr>
              </thead>
              <tbody>
                {filas.map((fila) => (
                  <tr key={fila.numero}>
                    <td><strong>{String(fila.numero).padStart(2, '0')}</strong></td>
                    <td>{fila.perfil
                      ? `${fila.perfil.first_name ?? ''} ${fila.perfil.last_name ?? ''}`.trim() || 'Sin nombre registrado'
                      : 'Perfil no disponible'}</td>
                    <td>{fila.perfil?.category || '—'}</td>
                    <td>{fila.perfil?.company || '—'}</td>
                    <td>{mostrarFecha(fila.fecha)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  )
}
