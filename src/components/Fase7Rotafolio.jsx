import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import './Fase7Definitiva.css'

const TITULOS = [
  'Nociones generales', 'Alimentación saludable', 'La pareja', 'La familia',
  'La niña y el niño', 'Salud mental', 'Discapacidad', 'Desarrollo humano', 'Medicina tradicional',
]

export default function Fase7Rotafolio({ capitulos = [] }) {
  const [lecciones, setLecciones] = useState([])
  const [capituloActual, setCapituloActual] = useState(1)
  const [indice, setIndice] = useState(0)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const presentacion = useRef(null)

  useEffect(() => {
    let vigente = true
    async function cargar() {
      const { data, error: fallo } = await supabase.from('lessons')
        .select('id,chapter_id,position,title,content')
        .eq('published', true)
        .gte('chapter_id', 1).lte('chapter_id', 9)
        .order('chapter_id', { ascending: true }).order('position', { ascending: true })
      if (!vigente) return
      setLecciones(data || [])
      setError(fallo?.message || '')
      setCargando(false)
    }
    void cargar()
    return () => { vigente = false }
  }, [])

  const nombres = useMemo(() => Array.from({ length: 9 }, (_, i) => ({
    id: i + 1, title: capitulos.find((c) => Number(c.id) === i + 1)?.title || TITULOS[i],
  })), [capitulos])
  const laminas = lecciones.filter((l) => Number(l.chapter_id) === Number(capituloActual))
  const lamina = laminas[indice] || null

  function seleccionarCapitulo(id) { setCapituloActual(Number(id)); setIndice(0) }
  async function pantallaCompleta() {
    if (!presentacion.current || !document.fullscreenEnabled) return
    try {
      if (document.fullscreenElement) await document.exitFullscreen()
      else await presentacion.current.requestFullscreen()
    } catch (e) { setError(`No se pudo activar la pantalla completa: ${e.message}`) }
  }

  return <section className="c7">
    <header className="c7-hero">
      <span>CENTINELA DIGITAL · APOYO A LA INSTRUCCIÓN</span>
      <h2>Rotafolio digital</h2>
      <p>45 láminas previstas, obtenidas de las enseñanzas de Mi aprendizaje. No se duplican fotografías ni textos.</p>
    </header>
    {error && <p className="c7-error" role="alert">{error}</p>}
    <div className="c7-panel">
      <label className="c7-etiqueta" htmlFor="c7-rotafolio-capitulo">Selecciona un capítulo</label>
      <select id="c7-rotafolio-capitulo" className="c7-select" value={capituloActual}
        onChange={(e) => seleccionarCapitulo(e.target.value)}>
        {nombres.map((c) => <option value={c.id} key={c.id}>{c.title}</option>)}
      </select>
      {cargando && <p>Cargando láminas…</p>}
      {!cargando && !lamina && <p>No hay láminas publicadas o accesibles para este capítulo.</p>}
      {lamina && <div className="c7-presentacion" ref={presentacion}>
        <div className="c7-slide-cabecera">
          <div><small>CAPÍTULO {String(capituloActual).padStart(2, '0')} · LÁMINA {indice + 1}/{laminas.length}</small>
            <h3>{lamina.title}</h3></div>
          <button type="button" className="c7-boton c7-boton-claro" onClick={() => void pantallaCompleta()}>⛶ Pantalla completa</button>
        </div>
        {lamina.content?.image_path && <div className="c7-imagen-marco">
          <img src={lamina.content.image_path} alt={`Ilustración educativa: ${lamina.title}`} />
        </div>}
        {lamina.content?.body && <p className="c7-lectura">{lamina.content.body}</p>}
        {lamina.content?.takeaway && <div className="c7-idea"><b>Para recordar:</b> {lamina.content.takeaway}</div>}
        <div className="c7-navegacion">
          <button type="button" className="c7-boton" disabled={indice === 0}
            onClick={() => setIndice((i) => Math.max(0, i - 1))}>← Anterior</button>
          <span>Lámina {indice + 1} de {laminas.length}</span>
          <button type="button" className="c7-boton" disabled={indice >= laminas.length - 1}
            onClick={() => setIndice((i) => Math.min(laminas.length - 1, i + 1))}>Siguiente →</button>
        </div>
      </div>}
    </div>
  </section>
}
