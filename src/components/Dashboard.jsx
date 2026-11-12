import { useEffect, useState } from 'react'
import MisAulas from './MisAulas'
import UnirseAula from './UnirseAula'
import MiAprendizaje from './MiAprendizaje'
import GestionTareas from './GestionTareas'
import TareasAsignadas from './TareasAsignadas'
import CalificacionesSeguimientoFase6 from './CalificacionesSeguimientoFase6'
import Fase7Biblioteca from './Fase7Biblioteca'
import Fase7Rotafolio from './Fase7Rotafolio'
import Fase7Noticias from './Fase7Noticias'
import Fase7RecursosInstructor from './Fase7RecursosInstructor'
import { supabase } from '../lib/supabase'
import './Dashboard.css'

// Cada fotografía se encuentra en public/assets; Vite la publica desde /assets/.
const IMAGENES = [
  'portada_libro_referencia.jpg',
  'educacion_nutricional_1.jpg',
  'dialogo_pareja.jpg',
  'lectura_familiar.jpg',
  'portada_libro_referencia.jpg',
  'portada_libro_referencia.jpg',
  'portada_libro_referencia.jpg',
  'servicio_comunitario_huerto.jpg',
  'portada_libro_referencia.jpg',
]

const RESUMENES = [
  'Salud, política sanitaria y aprendizaje de formas de vida saludables.',
  'Orientación alimentaria para la tropa, la niñez y la familia.',
  'Educación sexual, planificación familiar, embarazo y prevención.',
  'Higiene, salud oral, vacunas y prevención de enfermedades.',
  'Prevención y cuidado de enfermedades y riesgos durante la niñez.',
  'Bienestar emocional, prevención de adicciones y convivencia.',
  'Prevención, rehabilitación, inclusión y accesibilidad.',
  'Papel del centinela en la comunidad, ambiente y desastres.',
  'Saberes tradicionales vinculados al cuidado de la salud.',
]

const MENU_INSTRUIDO = [
  { id: 'inicio', icono: '⌂', nombre: 'Inicio' },
  { id: 'aprendizaje', icono: '▤', nombre: 'Mi aprendizaje' },
  { id: 'tareas', icono: '✓', nombre: 'Tareas asignadas' },
  { id: 'pdf', icono: '▧', nombre: 'Biblioteca PDF' },
  { id: 'audiovisual', icono: '▶', nombre: 'Biblioteca audiovisual' },
  { id: 'rotafolio', icono: '▣', nombre: 'Rotafolio digital' },
  { id: 'noticias', icono: '▤', nombre: 'Noticias' },
  { id: 'perfil', icono: '⚓', nombre: 'Mi perfil' },
]

const MENU_INSTRUCTOR = [
  { id: 'inicio', icono: '⌂', nombre: 'Inicio' },
  { id: 'aulas', icono: '▥', nombre: 'Mis aulas' },
  { id: 'contenido', icono: '▤', nombre: 'Contenido educativo' },
  { id: 'gestion', icono: '✓', nombre: 'Gestión de tareas' },
  { id: 'calificaciones', icono: '▥', nombre: 'Calificaciones y seguimiento' },
  { id: 'rotafolio', icono: '▣', nombre: 'Rotafolio digital' },
  { id: 'recursos', icono: '▧', nombre: 'Biblioteca de recursos' },
  { id: 'perfil', icono: '♙', nombre: 'Mi perfil' },
]

export default function Dashboard({ sesion, perfil, capitulos = [], onLogout }) {
  const [pagina, setPagina] = useState('inicio')
  const [detalle, setDetalle] = useState(null)
  const [menuAbierto, setMenuAbierto] = useState(false)
  const [capitulosAprobados, setCapitulosAprobados] = useState(new Set())

  const rol = String(perfil?.role ?? '').toLowerCase()
  const esInstructor = rol === 'instructor'
  const esAdmin = rol === 'admin' || rol === 'administrator'
  const estado = String(perfil?.approval_status ?? '').toLowerCase()
  const instructorAprobado = esAdmin || (esInstructor && (estado === 'approved' || estado === 'aprobado'))
  const nombre = [perfil?.first_name, perfil?.last_name].filter(Boolean).join(' ').trim()
  const rotuloPerfil = esAdmin ? 'ADMINISTRADOR' : esInstructor ? 'INSTRUCTOR' : 'INSTRUIDO'
  const MENU = esInstructor ? MENU_INSTRUCTOR : MENU_INSTRUIDO

  // Desbloqueo visual basado en aprobaciones reales: el servidor vuelve a validar el acceso.
  const puedeConsultar = (indice) => instructorAprobado || indice === 0 ||
    capitulosAprobados.has(capitulos[indice - 1]?.id)

  useEffect(() => {
    if (!sesion?.user?.id || esInstructor || esAdmin) return
    let activo = true
    async function cargarCapitulosAprobados() {
      const { data, error } = await supabase
        .from('chapter_results')
        .select('chapter_id')
        .eq('user_id', sesion.user.id)
        .eq('passed', true)
      if (error) {
        // Mantenemos capítulos bloqueados ante un error, nunca habilitamos sin autorización.
        console.warn('No se pudieron consultar los desbloqueos:', error.message)
        return
      }
      if (activo) setCapitulosAprobados(new Set((data ?? []).map((registro) => registro.chapter_id)))
    }
    void cargarCapitulosAprobados()
    return () => { activo = false }
  }, [sesion?.user?.id, esInstructor, esAdmin])

  function navegar(destino) {
    setPagina(destino)
    setDetalle(null)
    setMenuAbierto(false)
  }

  function abrirCapitulo(indice) {
    if (!puedeConsultar(indice)) return
    setDetalle(indice)
    setPagina(esInstructor ? 'contenido' : 'aprendizaje')
  }

  function tarjetas() {
    return (
      <div className="cd-tarjetas">
        {capitulos.map((capitulo, i) => {
          const abierto = puedeConsultar(i)
          return (
            <button
              type="button"
              key={capitulo.id ?? i}
              className={`cd-tarjeta ${!abierto ? 'cd-bloqueado' : ''}`}
              disabled={!abierto}
              onClick={() => abrirCapitulo(i)}
              title={abierto ? 'Consultar el capítulo' : 'Pendiente de desbloqueo al aprobar el capítulo anterior'}
            >
              <span className="cd-numero">CAPÍTULO {String(i + 1).padStart(2, '0')}</span>
              <img
                className="cd-imagen-capitulo"
                src={`/assets/${IMAGENES[i] ?? IMAGENES[0]}`}
                alt={`Imagen de referencia para ${capitulo.title}`}
              />
              <strong>{capitulo.title}</strong>
              <span className="cd-descripcion">{capitulo.summary || RESUMENES[i] || 'Material de formación institucional.'}</span>
              <span className="cd-chip">{abierto ? 'Ver capítulo →' : '🔒 Bloqueado'}</span>
            </button>
          )
        })}
      </div>
    )
  }

  function encabezadoSeccion(titulo, descripcion) {
    return (
      <div className="cd-seccion-titulo">
        <div>
          <h2>{titulo}</h2>
          <p>{descripcion}</p>
        </div>
      </div>
    )
  }

  function mostrarContenido() {
    if (pagina === 'inicio') {
      if (esInstructor) {
        return <>
          <section className="cd-estadisticas" aria-label="Resumen para instructor">
            <div className="cd-indicador"><strong>{String(capitulos.length).padStart(2, '0')}</strong><span>Capítulos para preparar</span></div>
            <div className="cd-indicador"><strong>—</strong><span>Gestiona tus aulas en Mis aulas</span></div>
            <div className="cd-indicador"><strong>—</strong><span>Tropa inscrita: pendiente</span></div>
            <div className="cd-indicador"><strong>—</strong><span>Tareas: seguimiento pendiente</span></div>
          </section>
          <section className="cd-mision">
            <span className="cd-estrella">✦</span>
            <div>
              <small>PANEL INSTRUCTOR · CUENTA APROBADA</small>
              <h2>Organizar. Enseñar. Evaluar.</h2>
              <p>Bienvenido, {nombre || 'instructor'}. Prepara la instrucción y gestiona tus aulas desde este panel.</p>
            </div>
            <button type="button" onClick={() => navegar('aulas')}>Mis aulas →</button>
          </section>
          {encabezadoSeccion('Contenido educativo', 'Consulta de los nueve capítulos desde Supabase para preparar tus clases.')}
          {tarjetas()}
        </>
      }
      return <>
        <section className="cd-estadisticas" aria-label="Resumen de aprendizaje">
          <div className="cd-indicador"><strong>{String(capitulos.length).padStart(2, '0')}</strong><span>Capítulos registrados</span></div>
          <div className="cd-indicador"><strong>PDF</strong><span>Material por incorporar</span></div>
          <div className="cd-indicador"><strong>04</strong><span>Tipos de ejercicios previstos</span></div>
          <div className="cd-indicador"><strong>—</strong><span>Avance: pendiente de sincronización</span></div>
        </section>
        <section className="cd-mision">
          <span className="cd-estrella">✦</span>
          <div>
            <small>LA RUTA DEL CENTINELA · PANEL INSTRUIDO</small>
            <h2>Aprender. Practicar. Proteger.</h2>
            <p>Bienvenido, {nombre || 'participante'}. Continúa tu formación con lecciones, práctica y seguimiento académico.</p>
          </div>
          <button type="button" onClick={() => navegar('aprendizaje')}>Comenzar la ruta →</button>
        </section>
        <UnirseAula userId={sesion?.user?.id} />
        {encabezadoSeccion('Mi aprendizaje', 'Los capítulos se consultan desde Supabase. El desbloqueo real se integrará en una siguiente fase.')}
        {tarjetas()}
      </>
    }

    if (pagina === 'aulas' && esInstructor && instructorAprobado) {
      return <MisAulas instructorId={sesion?.user?.id} />
    }

    if (pagina === 'aprendizaje' || pagina === 'contenido') {
      if (detalle !== null) {
        const capitulo = capitulos[detalle]
        if (!capitulo) return <p>No se encontró el capítulo seleccionado.</p>
        return <MiAprendizaje
          capitulo={capitulo}
          esInstructor={esInstructor || esAdmin}
          onVolver={() => setDetalle(null)}
          onAprobado={(chapterId) => setCapitulosAprobados((anteriores) =>
            new Set([...anteriores, chapterId]))}
        />
      }
      return <>
        {encabezadoSeccion(esInstructor ? 'Contenido educativo' : 'Mi aprendizaje', 'Consulta los nueve capítulos de CENTINELA DIGITAL.')}
        {tarjetas()}
      </>
    }

    if (pagina === 'gestion' && esInstructor && instructorAprobado) {
      return <GestionTareas />
    }
    if (pagina === 'calificaciones' && esInstructor && instructorAprobado) {
      return <CalificacionesSeguimientoFase6 />
    }
    if (pagina === 'tareas' && !esInstructor && !esAdmin) {
      return <TareasAsignadas />
    }

    /* FASE7_DEFINITIVA_REACT */
    if (pagina === 'recursos' && esInstructor && instructorAprobado) {
      return <Fase7RecursosInstructor capitulos={capitulos} />
    }
    if (pagina === 'rotafolio' && esInstructor && instructorAprobado) {
      return <Fase7Rotafolio capitulos={capitulos} />
    }
    if (pagina === 'pdf' && !esInstructor && !esAdmin) {
      return <Fase7Biblioteca tipo="pdf" capitulos={capitulos} />
    }
    if (pagina === 'audiovisual' && !esInstructor && !esAdmin) {
      return <Fase7Biblioteca tipo="audiovisual" capitulos={capitulos} />
    }
    if (pagina === 'rotafolio' && !esInstructor && !esAdmin) {
      return <Fase7Rotafolio capitulos={capitulos} />
    }
    if (pagina === 'noticias' && !esInstructor && !esAdmin) {
      return <Fase7Noticias esInstructor={false} />
    }
    if (pagina === 'perfil') {
      return <section className="cd-panel">
        <h2>Mi perfil · {rotuloPerfil}</h2>
        <p><b>Nombres y apellidos:</b> {nombre || 'Pendiente de completar'}</p>
        <p><b>Correo:</b> {sesion?.user?.email ?? '—'}</p>
        <p><b>Rol:</b> {rotuloPerfil}</p>
        <p><b>Estado:</b> {estado || '—'}</p>
        <p><b>Categoría / grado:</b> {perfil?.category || '—'}</p>
        <p><b>Compañía:</b> {perfil?.company || '—'}</p>
        <p><b>Gran Unidad:</b> {perfil?.large_unit || '—'}</p>
        <p><b>Pequeña Unidad:</b> {perfil?.small_unit || '—'}</p>
        {!esInstructor && !esAdmin && <UnirseAula userId={sesion?.user?.id} compacta />}
        {(esInstructor || esAdmin) && <div className="cd-aviso">Para revisar aulas, utiliza la sección Mis aulas. No muestres contraseñas en este panel.</div>}
      </section>
    }

    const item = MENU.find((entrada) => entrada.id === pagina)
    if (!item) return <section className="cd-panel"><h2>Acceso no disponible</h2><p>No existe esta sección en tu perfil.</p></section>
    return <section className="cd-panel">
      <h2>{item.nombre}</h2>
      <p>Esta sección forma parte del panel de {rotuloPerfil}.</p>
      <div className="cd-aviso">Funcionalidad pendiente de implementación. No se han generado datos, tareas ni calificaciones ficticias.</div>
    </section>
  }

  return (
    <div className="cd-app">
      <header className="cd-encabezado">
        <img src="/assets/escudo_armada_boliviana_original.jpeg" alt="Escudo de la Armada Boliviana" />
        <div className="cd-marca">
          <small>ARMADA BOLIVIANA · ECEMN</small>
          <h1>CENTINELA DIGITAL</h1>
          <p>Plataforma digital de apoyo a la instrucción integral</p>
        </div>
        <img src="/assets/escudo_ecemn_original.jpeg" alt="Escudo ECEMN" />
      </header>

      <div className="cd-barra-usuario">
        <span>{nombre || sesion?.user?.email || 'Usuario'} · {rotuloPerfil}</span>
        <button type="button" onClick={onLogout}>Cerrar sesión</button>
      </div>

      <button className="cd-alternar-menu" type="button" onClick={() => setMenuAbierto((valor) => !valor)}>
        ☰ Menú de navegación
      </button>
      <div className="cd-disposicion">
        <aside className={`cd-menu ${menuAbierto ? 'cd-menu-abierto' : ''}`} aria-label="Navegación principal">
          <p className="cd-titulo-menu">NAVEGACIÓN PRINCIPAL</p>
          {MENU.map((item, i) => (
            <div key={item.id}>
              {i === 7 && <p className="cd-titulo-menu cd-titulo-perfiles">MI CUENTA</p>}
              <button
                type="button"
                className={`cd-nav ${pagina === item.id ? 'cd-nav-activo' : ''}`}
                onClick={() => navegar(item.id)}
              >
                <span className="cd-icono">{item.icono}</span>{item.nombre}
              </button>
            </div>
          ))}
          <p className="cd-pie-menu">Panel con acceso diferenciado. Datos y funciones protegidos por Supabase.</p>
        </aside>
        <main className="cd-contenido">{mostrarContenido()}</main>
      </div>
      <footer className="cd-footer">
        <div>CENTINELA DIGITAL · Aprender para servir, prevenir y proteger.</div>
        <div>© 2026 CENTINELA DIGITAL · Todos los derechos reservados.</div>
        <div>Desarrollado por: TF CGON Yamil Mamani Quisber</div>
      </footer>
    </div>
  
  )
}
