import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import './SeguimientoFase6.css'
import { exportarExcelSeguimiento } from './ExcelSeguimientoFase6'

function mostrarNota(nota) {
  return nota === null || nota === undefined ? '—' : `${nota}/100`
}

function textoFecha(valor) {
  if (!valor) return '—'
  const fecha = new Date(valor)
  return Number.isNaN(fecha.getTime()) ? '—' : fecha.toLocaleString('es-BO')
}

function estadoTarea(estado) {
  return {
    entregado: 'Entregado',
    pendiente: 'Pendiente',
    vencido: 'Vencido',
    no_asignado: 'Sin asignar',
  }[estado] || 'Sin asignar'
}

export default function SeguimientoFase6() {
  const [aulas, setAulas] = useState([])
  const [aulaId, setAulaId] = useState('')
  const [reporte, setReporte] = useState(null)
  const [cargandoAulas, setCargandoAulas] = useState(true)
  const [cargandoReporte, setCargandoReporte] = useState(false)
  const [error, setError] = useState('')
  const [exportandoExcel, setExportandoExcel] = useState(false)
  const [actualizacion, setActualizacion] = useState(0)
  const [busqueda, setBusqueda] = useState('')
  const [seleccionado, setSeleccionado] = useState(null)

  useEffect(() => {
    let activo = true
    async function cargarAulas() {
      setCargandoAulas(true)
      const { data, error: fallo } = await supabase.rpc('centinela_task_my_classrooms')
      if (!activo) return
      if (fallo) setError(fallo.message)
      else {
        const lista = data || []
        setAulas(lista)
        setAulaId((previo) => lista.some((a) => a.id === previo) ? previo : (lista[0]?.id || ''))
      }
      setCargandoAulas(false)
    }
    void cargarAulas()
    return () => { activo = false }
  }, [])

  useEffect(() => {
    if (!aulaId) { setReporte(null); return }
    let activo = true
    async function cargarReporte() {
      setCargandoReporte(true)
      setError('')
      const { data, error: fallo } = await supabase.rpc('centinela_fase6_reporte_aula', {
        p_classroom: aulaId,
      })
      if (!activo) return
      if (fallo) { setError(fallo.message); setReporte(null) }
      else setReporte(data || null)
      setCargandoReporte(false)
    }
    void cargarReporte()
    return () => { activo = false }
  }, [aulaId, actualizacion])

  const integrantes = Array.isArray(reporte?.integrantes) ? reporte.integrantes : []
  const filtrados = useMemo(() => {
    const consulta = busqueda.trim().toLocaleLowerCase('es')
    if (!consulta) return integrantes
    return integrantes.filter((p) =>
      `${p.nombre} ${String(p.numero).padStart(2, '0')}`.toLocaleLowerCase('es').includes(consulta))
  }, [integrantes, busqueda])

  const estudiante = integrantes.find((p) => p.usuario_id === seleccionado)
  const resumen = reporte?.resumen || {}
  const totalIntegrantes = Number(resumen.integrantes || 0)
  const numeroCapitulos = Number(resumen.capitulos_disponibles || 9)
  const totalLecciones = Number(resumen.lecciones_disponibles || 45)
  const numeroTareas = Number(resumen.tareas_asignadas || 0)
  const totalEntregas = totalIntegrantes * numeroTareas
  const entregas = Number(resumen.entregas || 0)
  const porcentajeEntregas = totalEntregas ? Math.min(100, Math.round(100 * entregas / totalEntregas)) : 0

  async function descargarExcel() {
    if (!reporte || exportandoExcel) return
    setExportandoExcel(true)
    setError('')
    try {
      await exportarExcelSeguimiento(reporte)
    } catch (fallo) {
      setError(`No se pudo generar el archivo Excel: ${fallo?.message || 'Error inesperado'}`)
    } finally {
      setExportandoExcel(false)
    }
  }

  function elegirAula(id) {
    setSeleccionado(null)
    setBusqueda('')
    setReporte(null)
    setAulaId(id)
  }

  return <section className="cd6">
    <div className="cd6-hero">
      <span>FASE 6 · PANEL INSTRUCTOR</span>
      <h2>Seguimiento académico por aula</h2>
      <p>Progreso de las nueve unidades y notas de los cuestionarios A, B y C, consultados en tiempo real desde Supabase.</p>
    </div>

    <div className="cd6-superior">
      <label htmlFor="cd6-aula">Seleccionar aula
        <select id="cd6-aula" value={aulaId} onChange={(e) => elegirAula(e.target.value)} disabled={cargandoAulas || aulas.length === 0}>
          {aulas.length === 0 && <option value="">Sin aulas registradas</option>}
          {aulas.map((aula) => <option key={aula.id} value={aula.id}>{aula.title} · {aula.code}</option>)}
        </select>
      </label>
      <div className="cd6-acciones">
        <button type="button" className="cd6-boton-sec" disabled={!aulaId || cargandoReporte} onClick={() => setActualizacion((v) => v + 1)}>Actualizar</button>
        <button type="button" className="cd6-boton" disabled={!reporte || integrantes.length === 0 || exportandoExcel} onClick={descargarExcel}>{exportandoExcel ? 'Generando Excel...' : 'Exportar Excel (.xlsx)'}</button>
      </div>
    </div>

    {error && <p role="alert" className="cd6-error">{error}</p>}
    {cargandoAulas && <p className="cd6-info">Consultando aulas del instructor...</p>}
    {cargandoReporte && <p className="cd6-info">Consultando el progreso y las calificaciones del aula...</p>}
    {!cargandoAulas && aulas.length === 0 && !error && <p className="cd6-info">Todavía no hay aulas. Crea una desde «Mis aulas».</p>}

    {reporte && !cargandoReporte && <>
      <div className="cd6-metricas">
        <article><span>Integrantes</span><strong>{totalIntegrantes}</strong><small>Inscritos actualmente</small></article>
        <article><span>Capítulos aprobados</span><strong>{resumen.capitulos_aprobados ?? 0}</strong><small>De {totalIntegrantes * numeroCapitulos} posibles</small></article>
        <article><span>Enseñanzas completadas</span><strong>{resumen.lecciones_completadas ?? 0}</strong><small>De {totalIntegrantes * totalLecciones} posibles</small></article>
        <article><span>Cuestionarios entregados</span><strong>{entregas}/{totalEntregas}</strong><small>{porcentajeEntregas}% de las entregas esperadas</small></article>
        <article><span>Promedio de cuestionarios</span><strong>{mostrarNota(resumen.promedio_tareas)}</strong><small>Solo entregas realizadas</small></article>
      </div>

      <div className="cd6-panel">
        <div className="cd6-titulo-tabla">
          <div><h3>Nómina y seguimiento individual</h3><p>Selecciona un integrante para consultar sus nueve capítulos y sus tareas A, B y C.</p></div>
          <label htmlFor="cd6-buscar">Buscar integrante
            <input id="cd6-buscar" type="search" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Nombre o N.º" />
          </label>
        </div>
        {totalIntegrantes === 0 ? <p>Aún no hay integrantes inscritos en esta aula.</p> : <div className="cd6-desborde"><table className="cd6-tabla">
          <thead><tr><th>N.º</th><th>Integrante</th><th>Capítulos aprobados</th><th>Enseñanzas</th><th>A / B / C</th><th>Promedio</th><th>Detalle</th></tr></thead>
          <tbody>{filtrados.map((p) => <tr key={p.usuario_id}>
            <td>{String(p.numero).padStart(2, '0')}</td><td><strong>{p.nombre || 'Sin nombre'}</strong></td>
            <td>{p.capitulos_aprobados}/{numeroCapitulos}</td>
            <td>{p.lecciones_completadas}/{totalLecciones}</td>
            <td>{(p.tareas || []).map((t) => <span key={t.codigo} className={`cd6-estado cd6-${t.estado}`} title={`Cuestionario ${t.codigo}: ${estadoTarea(t.estado)}`}>
              {t.codigo}: {t.entregado ? t.nota : (t.asignado ? '—' : 'N/A')}
            </span>)}</td>
            <td>{mostrarNota(p.promedio_tareas)}</td>
            <td><button type="button" className="cd6-boton-sec" onClick={() => setSeleccionado((actual) => actual === p.usuario_id ? null : p.usuario_id)}>
              {seleccionado === p.usuario_id ? 'Cerrar' : 'Ver detalle'}
            </button></td>
          </tr>)}</tbody>
        </table></div>}
        {totalIntegrantes > 0 && filtrados.length === 0 && <p>No se encontraron integrantes con esa búsqueda.</p>}
      </div>

      {estudiante && <div className="cd6-panel cd6-detalle">
        <div className="cd6-titulo-tabla"><div><span className="cd6-sobretitulo">FICHA INDIVIDUAL</span>
          <h3>N.º {String(estudiante.numero).padStart(2, '0')} · {estudiante.nombre}</h3>
          <p>El progreso de «Mi aprendizaje» pertenece al estudiante y se conserva aunque participe en más de un aula.</p>
        </div><button type="button" className="cd6-boton-sec" onClick={() => setSeleccionado(null)}>Cerrar ficha</button></div>
        <h4>Mi aprendizaje · nueve capítulos</h4>
        <div className="cd6-desborde"><table className="cd6-tabla"><thead><tr><th>Capítulo</th><th>Enseñanzas</th><th>Mejor nota</th><th>Intentos</th><th>Estado</th></tr></thead>
          <tbody>{(estudiante.capitulos || []).map((c) => <tr key={c.id}>
            <td>{String(c.id).padStart(2, '0')} · {c.titulo}</td>
            <td>{c.lecciones_completadas}/{c.total_lecciones}</td>
            <td>{mostrarNota(c.mejor_nota)}</td>
            <td>{c.intentos}</td>
            <td><span className={`cd6-estado ${c.aprobado ? 'cd6-aprobado' : 'cd6-pendiente'}`}>{c.aprobado ? 'Aprobado' : 'Sin aprobar'}</span></td>
          </tr>)}</tbody>
        </table></div>
        <h4>Tareas asignadas · A, B y C</h4>
        <div className="cd6-desborde"><table className="cd6-tabla"><thead><tr><th>Cuestionario</th><th>Estado</th><th>Nota</th><th>Fecha límite</th><th>Entrega</th></tr></thead>
          <tbody>{(estudiante.tareas || []).map((t) => <tr key={t.codigo}>
            <td>{t.codigo}</td><td><span className={`cd6-estado cd6-${t.estado}`}>{estadoTarea(t.estado)}</span></td>
            <td>{mostrarNota(t.nota)}</td><td>{textoFecha(t.fecha_limite)}</td><td>{textoFecha(t.fecha_entrega)}</td>
          </tr>)}</tbody>
        </table></div>
      </div>}
      <p className="cd6-nota">Los promedios incluyen únicamente cuestionarios entregados; las tareas pendientes no reciben una nota ficticia. La exportación Excel contiene datos personales: almacénala y compártela solo con personal autorizado.</p>
    </>}
  </section>
}
