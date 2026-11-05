import { useEffect, useState } from 'react'
import Dashboard from './components/Dashboard'
import { supabase } from './lib/supabase'
import './index.css'

function App() {
  const [modo, setModo] = useState('ingresar')
  const [rol, setRol] = useState('tropa')
  const [sesion, setSesion] = useState(null)
  const [perfil, setPerfil] = useState(null)
  const [capitulos, setCapitulos] = useState([])
  const [mensaje, setMensaje] = useState('')
  const [cargando, setCargando] = useState(false)
  const [verificandoSesion, setVerificandoSesion] = useState(true)
  const [cargandoPerfil, setCargandoPerfil] = useState(false)
  const [errorPerfil, setErrorPerfil] = useState('')
  const [actualizacion, setActualizacion] = useState(0)

  useEffect(() => {
    let activo = true

    supabase.auth.getSession().then(({ data, error }) => {
      if (!activo) return
      if (error) setMensaje(error.message)
      setSesion(data?.session ?? null)
      setVerificandoSesion(false)
    }).catch((error) => {
      if (!activo) return
      setMensaje(error.message)
      setVerificandoSesion(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_evento, sesionActual) => {
      if (!activo) return
      setSesion(sesionActual)
      setVerificandoSesion(false)
    })

    return () => {
      activo = false
      subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (!sesion?.user?.id) {
      setPerfil(null)
      setCapitulos([])
      setErrorPerfil('')
      setCargandoPerfil(false)
      return
    }

    let activo = true
    setPerfil(null)
    setErrorPerfil('')
    setCargandoPerfil(true)
    setCapitulos([])

    async function cargarDatos() {
      try {
        const [respuestaPerfil, respuestaCapitulos] = await Promise.all([
          supabase
            .from('profiles')
            .select('id,first_name,last_name,role,approval_status,category,company,large_unit,small_unit')
            .eq('id', sesion.user.id)
            .single(),
          supabase
            .from('chapters')
            .select('id,title,summary')
            .order('id'),
        ])
        if (!activo) return

        if (respuestaPerfil.error) {
          setErrorPerfil(`No se pudo consultar el perfil: ${respuestaPerfil.error.message}`)
        } else if (!respuestaPerfil.data) {
          setErrorPerfil('No se encontró un perfil institucional para esta cuenta.')
        } else {
          setPerfil(respuestaPerfil.data)
        }

        if (respuestaCapitulos.error) {
          setMensaje(`No se pudieron cargar los capítulos: ${respuestaCapitulos.error.message}`)
        } else {
          setCapitulos(respuestaCapitulos.data ?? [])
        }
      } catch (error) {
        if (activo) setErrorPerfil(error.message || 'Error al consultar el perfil.')
      } finally {
        if (activo) setCargandoPerfil(false)
      }
    }

    cargarDatos()
    return () => { activo = false }
  }, [sesion?.user?.id, actualizacion])

  async function enviarFormulario(evento) {
    evento.preventDefault()
    setCargando(true)
    setMensaje('')
    const datos = new FormData(evento.currentTarget)
    const email = String(datos.get('email') ?? '').trim()
    const password = String(datos.get('password') ?? '')

    try {
      if (modo === 'registro') {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              requested_role: rol,
              first_name: datos.get('first_name'),
              last_name: datos.get('last_name'),
              large_unit: datos.get('large_unit'),
              small_unit: datos.get('small_unit'),
              company: datos.get('company'),
              category: rol === 'tropa' ? datos.get('category') : '',
            },
          },
        })
        if (error) throw error
        setMensaje(data.session
          ? 'Cuenta creada correctamente.'
          : 'Solicitud recibida. Revisa tu correo para confirmar la cuenta, si corresponde.')
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
        setMensaje('Inicio de sesión correcto.')
      }
    } catch (error) {
      setMensaje(`Error: ${error.message}`)
    } finally {
      setCargando(false)
    }
  }

  async function cerrarSesion() {
    const { error } = await supabase.auth.signOut()
    if (error) setMensaje(`No se pudo cerrar sesión: ${error.message}`)
    else setMensaje('')
  }

  // Un mismo estilo visual, pero acceso estrictamente diferenciado por rol real.
  // La autorización efectiva de datos se mantiene en PostgreSQL/RLS.
  if (verificandoSesion || (sesion && (cargandoPerfil || (!perfil && !errorPerfil)))) {
    return <div className="plataforma"><div className="acceso" style={{ margin: '12vh auto', maxWidth: 480 }}>
      <h2>CENTINELA DIGITAL</h2><p>Verificando acceso institucional...</p>
    </div></div>
  }

  if (sesion) {
    if (errorPerfil || !perfil) {
      return <div className="plataforma"><div className="acceso" style={{ margin: '12vh auto', maxWidth: 520 }}>
        <h2>No se pudo verificar tu perfil</h2>
        <p className="aviso">{errorPerfil || 'No se encontró un perfil institucional.'}</p>
        <button type="button" className="boton-principal" onClick={() => setActualizacion(v => v + 1)}>Reintentar</button>
        <button type="button" className="boton-principal" onClick={cerrarSesion}>Cerrar sesión</button>
      </div></div>
    }

    const rolReal = String(perfil.role ?? '').toLowerCase()
    const estado = String(perfil.approval_status ?? '').toLowerCase()

    if (rolReal === 'instructor' && estado !== 'approved') {
      return <div className="plataforma"><header className="encabezado"><div className="marca">
        <div className="simbolo">✦</div><div><small>PLATAFORMA DE FORMACIÓN</small><h1>CENTINELA DIGITAL</h1></div>
      </div></header><div className="acceso" style={{ margin: '8vh auto', maxWidth: 620 }}>
        <h2>Solicitud de instructor</h2>
        <p>Bienvenido, {perfil.first_name} {perfil.last_name}.</p>
        <p className="aviso">{estado === 'pending'
          ? 'Tu solicitud está pendiente de aprobación por el administrador. Aún no puedes gestionar aulas ni tareas.'
          : estado === 'rejected'
            ? 'Tu solicitud no ha sido aprobada. Contacta al administrador institucional.'
            : 'El estado de tu cuenta requiere revisión.'}</p>
        <button type="button" className="boton-principal" onClick={() => setActualizacion(v => v + 1)}>Actualizar estado</button>
        <button type="button" className="boton-principal" onClick={cerrarSesion}>Cerrar sesión</button>
      </div></div>
    }

    if (rolReal === 'admin') {
      return <div className="plataforma"><div className="acceso" style={{ margin: '12vh auto', maxWidth: 550 }}>
        <h2>Acceso de administrador</h2>
        <p>La cuenta está identificada como ADMINISTRADOR. El panel interno de aprobación será desarrollado en una fase posterior.</p>
        <button type="button" className="boton-principal" onClick={cerrarSesion}>Cerrar sesión</button>
      </div></div>
    }

    if ((rolReal === 'tropa' || rolReal === 'instructor') && estado === 'approved') {
      return <Dashboard sesion={sesion} perfil={perfil} capitulos={capitulos} onLogout={cerrarSesion} />
    }

    return <div className="acceso" style={{ margin: '12vh auto', maxWidth: 530 }}>
      <h2>Acceso restringido</h2><p>Tu rol o estado institucional no permite ingresar al panel.</p>
      <button type="button" className="boton-principal" onClick={cerrarSesion}>Cerrar sesión</button>
    </div>
  }

  return (
    <div className="plataforma">
      <header className="encabezado">
        <div className="marca"><div className="simbolo">✦</div><div>
          <small>PLATAFORMA DE FORMACIÓN</small><h1>CENTINELA DIGITAL</h1>
        </div></div>
        <span className="etiqueta">Sistema educativo institucional</span>
      </header>
      <main className="principal">
        <section className="presentacion">
          <span className="sobretitulo">FORMACIÓN INTERACTIVA</span>
          <h2>El conocimiento también protege.</h2>
          <p>Plataforma de aprendizaje para la formación integral de la tropa, con lecciones interactivas, evaluaciones y seguimiento académico.</p>
          <div className="caracteristicas">
            <div>✓ Nueve capítulos de enseñanza</div>
            <div>✓ Actividades interactivas</div>
            <div>✓ Calificaciones sobre 100 puntos</div>
            <div>✓ Seguimiento por instructores</div>
          </div>
        </section>
        <section className="acceso">
          <div className="pestanas">
            <button type="button" className={modo === 'ingresar' ? 'activo' : ''} onClick={() => { setModo('ingresar'); setMensaje('') }}>Iniciar sesión</button>
            <button type="button" className={modo === 'registro' ? 'activo' : ''} onClick={() => { setModo('registro'); setMensaje('') }}>Registrarse</button>
          </div>
          <h2>{modo === 'registro' ? 'Crear cuenta' : 'Bienvenido'}</h2>
          <form onSubmit={enviarFormulario}>
            {modo === 'registro' && <>
              <div className="roles">
                <button type="button" className={rol === 'tropa' ? 'seleccionado' : ''} onClick={() => setRol('tropa')}>⚓ TROPA</button>
                <button type="button" className={rol === 'instructor' ? 'seleccionado' : ''} onClick={() => setRol('instructor')}>♙ INSTRUCTOR</button>
              </div>
              <label>Nombres</label><input name="first_name" required />
              <label>Apellidos</label><input name="last_name" required />
              <label>Gran Unidad</label><input name="large_unit" required />
              <label>Pequeña Unidad</label><input name="small_unit" required />
              <label>Compañía</label><input name="company" required />
              {rol === 'tropa' && <><label>Categoría</label><select name="category" required>
                <option value="">Seleccione</option><option>Marinero</option><option>Alumno</option><option>Cadete</option><option>Premilitar</option>
              </select></>}
              {rol === 'instructor' && <p className="aviso">Tu cuenta necesitará aprobación de un administrador.</p>}
            </>}
            <label>Correo electrónico</label><input name="email" type="email" required />
            <label>Contraseña</label><input name="password" type="password" minLength="8" required />
            <button className="boton-principal" type="submit" disabled={cargando}>
              {cargando ? 'Procesando...' : modo === 'registro' ? 'Crear cuenta' : 'Iniciar sesión'}
            </button>
          </form>
          {mensaje && <p className="aviso">{mensaje}</p>}
        </section>
      </main>
    </div>
  )
}

export default App
