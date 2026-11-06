import './Fase7Definitiva.css'

// Enlaces directos a portales oficiales. Noticias ya no consulta ni guarda
// datos en Supabase; no hay publicaciones, borradores ni asignaciones por aula.
const PORTALES = [
  {
    id: 'ffaa',
    icono: '⚓',
    titulo: 'Comando en Jefe de las Fuerzas Armadas',
    descripcion: 'Noticias y comunicados institucionales de las Fuerzas Armadas de Bolivia.',
    url: 'https://comanjefe.mil.bo/noticias/',
  },
  {
    id: 'armada',
    icono: '⚓',
    titulo: 'Armada Boliviana',
    descripcion: 'Portal oficial con novedades y actividades de la Armada Boliviana.',
    url: 'https://armada.mil.bo/',
  },
  {
    id: 'salud',
    icono: '▤',
    titulo: 'Ministerio de Salud y Deportes de Bolivia',
    descripcion: 'Notas de prensa y campañas de salud del Estado boliviano.',
    url: 'https://www.minsalud.gob.bo/centro-de-prensa/notas-de-prensa',
  },
  {
    id: 'ops',
    icono: '◎',
    titulo: 'Organización Panamericana de la Salud (OPS)',
    descripcion: 'Noticias, alertas y notas de prensa sobre salud en las Américas.',
    url: 'https://www.paho.org/es/noticias/notas-prensa',
  },
  {
    id: 'oms',
    icono: '◎',
    titulo: 'Organización Mundial de la Salud (OMS)',
    descripcion: 'Centro de prensa de la OMS, con información sanitaria mundial.',
    url: 'https://www.who.int/es/news-room',
  },
]

export default function Fase7Noticias() {
  return (
    <section className="c7">
      <header className="c7-hero">
        <span>CENTINELA DIGITAL · INFORMACIÓN INSTITUCIONAL</span>
        <h2>Noticias y portales oficiales</h2>
        <p>
          Consulta las últimas publicaciones directamente en las páginas oficiales.
          Los enlaces se abren en una pestaña nueva.
        </p>
      </header>
      <div className="c7-panel">
        <h3>Portales de noticias y salud</h3>
        <div className="c7-lista">
          {PORTALES.map((portal) => (
            <article className="c7-recurso c7-recurso-linea" key={portal.id}>
              <div className="c7-icon" aria-hidden="true">{portal.icono}</div>
              <div className="c7-recurso-info">
                <h3>{portal.titulo}</h3>
                <p>{portal.descripcion}</p>
              </div>
              <a
                className="c7-boton"
                href={portal.url}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`Abrir portal oficial: ${portal.titulo}`}
              >
                Abrir portal ↗
              </a>
            </article>
          ))}
        </div>
        <p className="c7-nota">
          CENTINELA DIGITAL enlaza fuentes externas. Las publicaciones, fechas y contenidos
          pertenecen a cada institución y pueden cambiar sin intervención de la plataforma.
        </p>
      </div>
    </section>
  )
}
