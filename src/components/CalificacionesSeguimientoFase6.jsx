import { useState } from 'react'
import CalificacionesTareas from './CalificacionesTareas'
import SeguimientoFase6 from './SeguimientoFase6'
import './SeguimientoFase6.css'

// Conserva la pantalla de notas por cuestionario de la Fase 5 sin modificarla.
export default function CalificacionesSeguimientoFase6() {
  const [vista, setVista] = useState('general')
  return <>
    <nav className="cd6-pestanas" aria-label="Vistas de calificaciones y seguimiento">
      <button type="button" aria-pressed={vista === 'general'} className={vista === 'general' ? 'cd6-pestana-activa' : ''} onClick={() => setVista('general')}>
        Seguimiento general por aula
      </button>
      <button type="button" aria-pressed={vista === 'cuestionarios'} className={vista === 'cuestionarios' ? 'cd6-pestana-activa' : ''} onClick={() => setVista('cuestionarios')}>
        Notas por cuestionario A, B y C
      </button>
    </nav>
    {vista === 'general' ? <SeguimientoFase6 /> : <CalificacionesTareas />}
  </>
}
