
import { useState } from 'react'

function App() {
  const [modo, setModo] = useState('ingresar')
  const [rol, setRol] = useState('tropa')
  const [mensaje, setMensaje] = useState('')

  function enviarFormulario(evento) {
    evento.preventDefault()
    setMensaje(
      'Esta es una demostración visual. Conectaremos el registro y el inicio de sesión a Supabase.'
    )
  }

  return (
    <div className="plataforma">
      <header className="encabezado">
        <div className="marca">
          <div className="simbolo">✦</div>
          <div>
            <small>PLATAFORMA DE FORMACIÓN</small>
            <h1>CENTINELA DIGITAL</h1>
          </div>
        </div>
        <span className="etiqueta">Sistema educativo institucional</span>
      </header>

      <main className="principal">
        <section className="presentacion">
          <span className="sobretitulo">FORMACIÓN INTERACTIVA</span>
          <h2>El conocimiento también protege.</h2>
          <p>
            Una nueva experiencia de aprendizaje para la formación
            integral de la tropa, mediante lecciones, actividades
            interactivas y seguimiento académico.
          </p>

          <div className="caracteristicas">
            <div>✓ Nueve capítulos de enseñanza</div>
            <div>✓ Actividades interactivas</div>
            <div>✓ Calificaciones sobre 100 puntos</div>
            <div>✓ Seguimiento por instructores</div>
          </div>
        </section>

        <section className="acceso">
          <div className="pestanas">
            <button
              className={modo === 'ingresar' ? 'activo' : ''}
              onClick={() => { setModo('ingresar'); setMensaje('') }}
            >
              Iniciar sesión
            </button>
            <button
              className={modo === 'registro' ? 'activo' : ''}
              onClick={() => { setModo('registro'); setMensaje('') }}
            >
              Registrarse
            </button>
          </div>

          <h2>{modo === 'ingresar' ? 'Bienvenido' : 'Crear cuenta'}</h2>
          <p className="subtexto">
            Selecciona tu perfil para continuar.
          </p>

          <div className="roles">
            <button
              className={rol === 'tropa' ? 'seleccionado' : ''}
              onClick={() => setRol('tropa')}
            >
              ⚓ TROPA
            </button>
            <button
              className={rol === 'instructor' ? 'seleccionado' : ''}
              onClick={() => setRol('instructor')}
            >
              ♙ INSTRUCTOR
            </button>
          </div>

          <form onSubmit={enviarFormulario}>
            {modo === 'registro' && (
              <>
                <label>Nombres</label>
                <input required placeholder="Nombres" />

                <label>Apellidos</label>
                <input required placeholder="Apellidos" />

                <label>Gran Unidad</label>
                <input required placeholder="Gran Unidad" />

                <label>Pequeña Unidad</label>
                <input required placeholder="Pequeña Unidad" />

                <label>Compañía</label>
                <input required placeholder="Compañía" />

                {rol === 'tropa' && (
                  <>
                    <label>Número de instruido</label>
                    <input
                      required
                      type="number"
                      min="1"
                      max="81"
                      placeholder="01 al 81"
                    />

                    <label>Categoría</label>
                    <select required>
                      <option>Marinero</option>
                      <option>Alumno</option>
                      <option>Cadete</option>
                      <option>Premilitar</option>
                    </select>
                  </>
                )}
              </>
            )}

            <label>Correo electrónico</label>
            <input
              type="email"
              placeholder="correo@ejemplo.com"
              required
            />

            <label>Contraseña</label>
            <input
              type="password"
              minLength="8"
              placeholder="Mínimo 8 caracteres"
              required
            />

            {modo === 'registro' && rol === 'instructor' && (
              <p className="aviso">
                La cuenta de instructor necesitará aprobación
                de un administrador.
              </p>
            )}

            <button className="boton-principal" type="submit">
              {modo === 'ingresar' ? 'Ingresar' : 'Crear cuenta'}
            </button>
          </form>

          {mensaje && <p className="aviso">{mensaje}</p>}

          <p className="pie-acceso">
            CENTINELA DIGITAL · Formación y conocimiento
          </p>
        </section>
      </main>
    </div>
  )
}

export default App
