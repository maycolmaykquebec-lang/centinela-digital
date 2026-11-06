import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import './Fase7Definitiva.css'

const TITULOS = [
  'Nociones generales', 'Alimentación saludable', 'La pareja', 'La familia',
  'La niña y el niño', 'Salud mental', 'Discapacidad', 'Desarrollo humano', 'Medicina tradicional',
]
const ICONOS = { youtube: '▶', oms: '◎', ops: '◎', minsalud: '▤' }

export default function Fase7Biblioteca({ tipo = 'pdf', capitulos = [] }) {
  const esPdf = tipo === 'pdf'
  const [registros, setRegistros] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [capituloActual, setCapituloActual] = useState(1)
  const listaCapitulos = useMemo(() => Array.from({ length: 9 }, (_, i) => ({
    id: i + 1,
    title: capitulos.find((c) => Number(c.id) === i + 1)?.title || TITULOS[i],
  })), [capitulos])

  useEffect(() => {
    let vigente = true
    async function cargar() {
      setCargando(true)
      const tabla = esPdf ? 'centinela7_pdfs' : 'centinela7_audio_links'
      const columnas = esPdf ? 'chapter_id,pdf_path,published' : 'code,title,description,base_url,search_mode,position'
      const { data, error: fallo } = await supabase.from(tabla).select(columnas)
        .order(esPdf ? 'chapter_id' : 'position', { ascending: true })
      if (!vigente) return
      setError(fallo?.message || '')
      setRegistros(data || [])
      setCargando(false)
    }
    void cargar()
    return () => { vigente = false }
  }, [esPdf])

  const seleccionado = listaCapitulos.find((c) => c.id === Number(capituloActual)) || listaCapitulos[0]

  return <section className="c7">
    <header className="c7-hero">
      <span>CENTINELA DIGITAL · RECURSOS EDUCATIVOS</span>
      <h2>{esPdf ? 'Biblioteca PDF' : 'Biblioteca audiovisual'}</h2>
      <p>{esPdf
        ? 'Nueve documentos institucionales, uno por capítulo. Los PDF aparecerán cuando sean incorporados y publicados.'
        : 'Fuentes institucionales y búsquedas de videos relacionadas con los nueve capítulos.'}</p>
    </header>
    {error && <p className="c7-error" role="alert">Error al cargar los recursos: {error}</p>}
    {cargando && <p className="c7-panel">Consultando los recursos de Supabase…</p>}
    {!cargando && esPdf && <div className="c7-grid">
      {listaCapitulos.map((capitulo) => {
        const recurso = registros.find((r) => Number(r.chapter_id) === capitulo.id)
        const disponible = Boolean(recurso?.published && recurso.pdf_path)
        return <article key={capitulo.id} className="c7-panel c7-recurso">
          <div className="c7-icon">▧</div>
          <div className="c7-recurso-info">
            <small>CAPÍTULO {String(capitulo.id).padStart(2, '0')}</small>
            <h3>{capitulo.title}</h3>
            <span className={disponible ? 'c7-estado c7-listo' : 'c7-estado'}>
              {disponible ? 'PDF disponible' : 'PDF pendiente de publicación'}
            </span>
          </div>
          {disponible && <a className="c7-boton" href={recurso.pdf_path}
            target="_blank" rel="noopener noreferrer">Abrir PDF ↗</a>}
        </article>
      })}
    </div>}
    {!cargando && !esPdf && <div className="c7-panel">
      <label className="c7-etiqueta" htmlFor="c7-seleccionar-capitulo">Capítulo relacionado</label>
      <select id="c7-seleccionar-capitulo" className="c7-select" value={capituloActual}
        onChange={(e) => setCapituloActual(Number(e.target.value))}>
        {listaCapitulos.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
      </select>
      <h3>Recursos para: {seleccionado.title}</h3>
      <div className="c7-lista">
        {registros.map((enlace) => {
          const esBusqueda = enlace.search_mode === 'youtube_search'
          const destino = esBusqueda
            ? `${enlace.base_url}${encodeURIComponent(`salud ${seleccionado.title} educación prevención`)}`
            : enlace.base_url
          return <article className="c7-recurso c7-recurso-linea" key={enlace.code}>
            <div className="c7-icon">{ICONOS[enlace.code] || '↗'}</div>
            <div className="c7-recurso-info">
              <h3>{enlace.title}</h3>
              <p>{enlace.description}</p>
            </div>
            <a className="c7-boton" href={destino} target="_blank" rel="noopener noreferrer">
              {esBusqueda ? 'Buscar ↗' : 'Abrir portal ↗'}
            </a>
          </article>
        })}
        {!registros.length && !error && <p>Por ahora no hay enlaces institucionales publicados.</p>}
      </div>
      <p className="c7-nota">Los resultados de YouTube no están previamente seleccionados ni aprobados. El instructor debe verificar autoría, fecha, pertinencia y contenido sanitario antes de utilizarlos.</p>
    </div>}
  </section>
}
