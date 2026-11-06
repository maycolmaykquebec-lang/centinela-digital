// CENTINELA DIGITAL · FASE 6 · Exportación institucional a Excel XLSX.
// No consulta Supabase de nuevo: utiliza el reporte ya autorizado para el instructor.
// Requiere: npm install exceljs@4.4.0

const COLORES = {
  azul: '142D45',
  azulClaro: '244C68',
  dorado: 'C9A34A',
  blanco: 'FFFFFF',
  fondo: 'EAF2F6',
  alterno: 'F5F9FB',
  texto: '17344A',
  secundario: '667F90',
  verdeFondo: 'E5F5ED',
  verdeTexto: '14613C',
  ambarFondo: 'FFF2D7',
  ambarTexto: '865B0C',
  grisFondo: 'EDF1F5',
  grisTexto: '64788B',
  borde: 'DCE7EE',
}

function limpiarTexto(valor) {
  const texto = String(valor ?? '').trim()
  // Los nombres se escriben como texto, jamás como fórmulas de Excel.
  return /^[=+@-]/.test(texto) ? `'${texto}` : texto
}

function numero(valor) {
  if (valor === null || valor === undefined || valor === '') return null
  const n = Number(valor)
  return Number.isFinite(n) ? n : null
}

function fechaExcel(valor) {
  if (!valor) return '—'
  const fecha = new Date(valor)
  return Number.isNaN(fecha.getTime()) ? '—' : fecha
}

function estadoTarea(estado) {
  return ({
    entregado: 'Entregado',
    pendiente: 'Pendiente',
    vencido: 'Vencido',
    no_asignado: 'Sin asignar',
  })[estado] || 'Sin asignar'
}

function tonoEstado(estado) {
  if (estado === 'entregado' || estado === 'aprobado') {
    return [COLORES.verdeFondo, COLORES.verdeTexto]
  }
  if (estado === 'vencido') return [COLORES.ambarFondo, COLORES.ambarTexto]
  return [COLORES.grisFondo, COLORES.grisTexto]
}

function rellenar(celda, fondo, texto = COLORES.texto, negrita = false) {
  celda.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${fondo}` } }
  celda.font = { name: 'Aptos', size: 10, color: { argb: `FF${texto}` }, bold: negrita }
  celda.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 }
}

function configurarHoja(hoja, { titulo, subtitulo, codigo, columnas, nombrePestana }) {
  const ancho = columnas.length
  hoja.columns = columnas.map((col) => ({ key: col.clave, width: col.ancho }))
  hoja.properties.tabColor = { argb: `FF${nombrePestana === 'Resumen' ? COLORES.dorado : COLORES.azulClaro}` }
  hoja.views = [{ state: 'frozen', xSplit: 2, ySplit: 10, topLeftCell: 'C11', activeCell: 'C11' }]
  hoja.pageSetup = { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9 }
  hoja.headerFooter.oddFooter = 'CENTINELA DIGITAL · USO INTERNO · Página &P de &N'

  hoja.mergeCells(1, 1, 2, ancho)
  const principal = hoja.getCell('A1')
  principal.value = titulo
  rellenar(principal, COLORES.azul, COLORES.blanco, true)
  principal.font = { name: 'Aptos Display', bold: true, size: 18, color: { argb: `FF${COLORES.blanco}` } }
  principal.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 }
  hoja.getRow(1).height = 26
  hoja.getRow(2).height = 21

  hoja.mergeCells(3, 1, 3, ancho)
  const sub = hoja.getCell('A3')
  sub.value = subtitulo
  rellenar(sub, COLORES.azulClaro, COLORES.blanco)
  sub.font = { name: 'Aptos', size: 11, color: { argb: `FF${COLORES.blanco}` } }
  hoja.getRow(3).height = 25

  hoja.mergeCells(4, 1, 4, ancho)
  const metadatos = hoja.getCell('A4')
  metadatos.value = `Aula: ${limpiarTexto(codigo)}  |  Generado: ${new Date().toLocaleString('es-BO')}  |  Uso interno del instructor`
  metadatos.font = { name: 'Aptos', size: 10, italic: true, color: { argb: `FF${COLORES.secundario}` } }
  metadatos.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 }
  hoja.getRow(4).height = 23

  hoja.getRow(5).height = 9
  hoja.getRow(8).height = 9
  hoja.mergeCells(9, 1, 9, ancho)
  hoja.getCell('A9').value = 'RELACIÓN DE DATOS'
  hoja.getCell('A9').font = { name: 'Aptos', size: 11, bold: true, color: { argb: `FF${COLORES.azul}` } }
  hoja.getRow(9).height = 21

  const encabezado = hoja.getRow(10)
  columnas.forEach((col, i) => {
    const celda = encabezado.getCell(i + 1)
    celda.value = col.nombre
    rellenar(celda, COLORES.azulClaro, COLORES.blanco, true)
    celda.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
  })
  encabezado.height = 38
}

function pintarFila(hoja, numeroFila, cantidadColumnas) {
  const fila = hoja.getRow(numeroFila)
  fila.height = 29
  for (let c = 1; c <= cantidadColumnas; c += 1) {
    const celda = fila.getCell(c)
    rellenar(celda, numeroFila % 2 === 0 ? COLORES.alterno : COLORES.blanco)
    celda.border = { bottom: { style: 'hair', color: { argb: `FF${COLORES.borde}` } } }
    if (typeof celda.value === 'number') celda.alignment = { horizontal: 'center', vertical: 'middle' }
    if (celda.value instanceof Date) {
      celda.numFmt = 'dd/mm/yyyy hh:mm'
      celda.alignment = { horizontal: 'center', vertical: 'middle' }
    }
  }
}

function notaColoreada(celda, nota, aprobado = null) {
  if (nota === null) {
    celda.value = '—'
    rellenar(celda, COLORES.grisFondo, COLORES.grisTexto)
  } else {
    celda.value = nota
    celda.numFmt = '0.0#'
    const [fondo, texto] = (aprobado === true || (aprobado === null && nota >= 70))
      ? [COLORES.verdeFondo, COLORES.verdeTexto]
      : [COLORES.ambarFondo, COLORES.ambarTexto]
    rellenar(celda, fondo, texto, true)
  }
  celda.alignment = { horizontal: 'center', vertical: 'middle' }
}

function agregarPie(hoja, primeraFila, ancho, mensaje) {
  hoja.mergeCells(primeraFila, 1, primeraFila, ancho)
  const celda = hoja.getCell(primeraFila, 1)
  celda.value = mensaje
  celda.font = { name: 'Aptos', size: 10, italic: true, color: { argb: `FF${COLORES.secundario}` } }
  celda.alignment = { vertical: 'middle', wrapText: true }
  hoja.getRow(primeraFila).height = 32
}

function aplicarAutofiltro(hoja, ultimaColumna, ultimaFila) {
  hoja.autoFilter = {
    from: { row: 10, column: 1 },
    to: { row: Math.max(10, ultimaFila), column: ultimaColumna },
  }
}

function tarjetaMetrica(hoja, desde, hasta, titulo, valor) {
  hoja.mergeCells(6, desde, 6, hasta)
  hoja.mergeCells(7, desde, 7, hasta)
  const etiqueta = hoja.getCell(6, desde)
  etiqueta.value = titulo
  rellenar(etiqueta, COLORES.fondo, COLORES.secundario, true)
  etiqueta.font = { name: 'Aptos', size: 9, bold: true, color: { argb: `FF${COLORES.secundario}` } }
  const dato = hoja.getCell(7, desde)
  dato.value = String(valor)
  rellenar(dato, COLORES.fondo, COLORES.azul, true)
  dato.font = { name: 'Aptos Display', size: 16, bold: true, color: { argb: `FF${COLORES.azul}` } }
  hoja.getRow(6).height = 22
  hoja.getRow(7).height = 33
}

function crearResumen(libro, reporte, integrantes) {
  const hoja = libro.addWorksheet('Resumen')
  const columnas = [
    { clave: 'numero', nombre: 'N.º', ancho: 9 },
    { clave: 'nombre', nombre: 'INTEGRANTE', ancho: 34 },
    { clave: 'aprobados', nombre: 'CAPÍTULOS\nAPROBADOS', ancho: 17 },
    { clave: 'lecciones', nombre: 'ENSEÑANZAS\nCOMPLETADAS', ancho: 19 },
    { clave: 'entregas', nombre: 'ENTREGAS', ancho: 15 },
    { clave: 'a', nombre: 'CUEST. A', ancho: 13 },
    { clave: 'b', nombre: 'CUEST. B', ancho: 13 },
    { clave: 'c', nombre: 'CUEST. C', ancho: 13 },
    { clave: 'promedio', nombre: 'PROMEDIO / 100', ancho: 18 },
  ]
  const resumen = reporte?.resumen || {}
  const posiblesCapitulos = Number(resumen.capitulos_disponibles ?? 9)
  const posiblesLecciones = Number(resumen.lecciones_disponibles ?? 45)
  const asignadas = Number(resumen.tareas_asignadas || 0)
  configurarHoja(hoja, {
    titulo: 'CENTINELA DIGITAL · SEGUIMIENTO ACADÉMICO',
    subtitulo: `PROGRAMA CENTINELA DE LA SALUD  |  ${limpiarTexto(reporte?.aula?.titulo || 'Aula')}`,
    codigo: reporte?.aula?.codigo || '', columnas, nombrePestana: 'Resumen',
  })
  tarjetaMetrica(hoja, 1, 2, 'INTEGRANTES', resumen.integrantes || 0)
  tarjetaMetrica(hoja, 3, 4, 'CAPÍTULOS APROBADOS', resumen.capitulos_aprobados || 0)
  tarjetaMetrica(hoja, 5, 6, 'ENSEÑANZAS COMPLETADAS', resumen.lecciones_completadas || 0)
  tarjetaMetrica(hoja, 7, 7, 'ENTREGAS', `${resumen.entregas || 0}/${integrantes.length * asignadas}`)
  tarjetaMetrica(hoja, 8, 9, 'PROMEDIO A/B/C', `${resumen.promedio_tareas ?? '—'}/100`)
  integrantes.forEach((p, i) => {
    const idx = i + 11
    const fila = hoja.getRow(idx)
    const tareas = Array.isArray(p.tareas) ? p.tareas : []
    const tarea = (codigo) => tareas.find((t) => t.codigo === codigo)
    fila.values = [
      null, String(p.numero ?? '').padStart(2, '0'), limpiarTexto(p.nombre || 'Sin nombre'),
      `${p.capitulos_aprobados ?? 0}/${posiblesCapitulos}`,
      `${p.lecciones_completadas ?? 0}/${posiblesLecciones}`,
      `${p.tareas_entregadas ?? 0}/${asignadas}`,
      ...['A', 'B', 'C'].map((codigo) => tarea(codigo)?.entregado ? numero(tarea(codigo)?.nota) : null),
      numero(p.promedio_tareas),
    ]
    pintarFila(hoja, idx, columnas.length)
    ;['A', 'B', 'C'].forEach((codigo, j) => {
      const t = tarea(codigo)
      const celda = fila.getCell(6 + j)
      if (t?.entregado) notaColoreada(celda, numero(t.nota))
      else {
        celda.value = t?.asignado ? estadoTarea(t.estado) : 'Sin asignar'
        const [fondo, texto] = tonoEstado(t?.estado)
        rellenar(celda, fondo, texto)
        celda.alignment = { horizontal: 'center', vertical: 'middle' }
      }
    })
    const promedio = numero(p.promedio_tareas)
    notaColoreada(fila.getCell(9), promedio)
  })
  aplicarAutofiltro(hoja, columnas.length, 10 + integrantes.length)
  agregarPie(hoja, 12 + integrantes.length, columnas.length,
    'Promedios calculados únicamente con tareas entregadas. Los guiones y las tareas pendientes no equivalen a cero. Documento de uso interno.')
}

function crearCapitulos(libro, reporte, integrantes) {
  const hoja = libro.addWorksheet('Capítulos')
  const columnas = [
    { clave: 'numero', nombre: 'N.º', ancho: 9 },
    { clave: 'nombre', nombre: 'INTEGRANTE', ancho: 34 },
    ...Array.from({ length: 9 }, (_, i) => ({ clave: `c${i + 1}`, nombre: `CAP. ${String(i + 1).padStart(2, '0')}`, ancho: 12 })),
    { clave: 'aprobados', nombre: 'APROBADOS', ancho: 15 },
    { clave: 'lecciones', nombre: 'ENSEÑANZAS', ancho: 16 },
  ]
  configurarHoja(hoja, {
    titulo: 'CENTINELA DIGITAL · MI APRENDIZAJE',
    subtitulo: 'Mejor calificación por capítulo (sobre 100 puntos)',
    codigo: reporte?.aula?.codigo || '', columnas, nombrePestana: 'Capítulos',
  })
  hoja.mergeCells(6, 1, 6, columnas.length)
  hoja.getCell('A6').value = 'VERDE = APROBADO   ·   DORADO = SIN APROBAR   ·   GRIS = SIN EVALUACIÓN'
  hoja.getCell('A6').font = { name: 'Aptos', size: 10, color: { argb: `FF${COLORES.azulClaro}` }, bold: true }
  hoja.getRow(6).height = 23
  const totalCap = Number(reporte?.resumen?.capitulos_disponibles || 9)
  const totalLecc = Number(reporte?.resumen?.lecciones_disponibles || 45)
  integrantes.forEach((p, i) => {
    const idx = i + 11
    const fila = hoja.getRow(idx)
    fila.getCell(1).value = String(p.numero ?? '').padStart(2, '0')
    fila.getCell(2).value = limpiarTexto(p.nombre || 'Sin nombre')
    const capitulos = Array.isArray(p.capitulos) ? p.capitulos : []
    for (let c = 1; c <= 9; c += 1) {
      const cap = capitulos.find((v) => Number(v.id) === c)
      const nota = numero(cap?.mejor_nota)
      fila.getCell(c + 2).value = nota ?? '—'
    }
    fila.getCell(12).value = `${p.capitulos_aprobados ?? 0}/${totalCap}`
    fila.getCell(13).value = `${p.lecciones_completadas ?? 0}/${totalLecc}`
    pintarFila(hoja, idx, columnas.length)
    for (let c = 1; c <= 9; c += 1) {
      const cap = capitulos.find((v) => Number(v.id) === c)
      notaColoreada(fila.getCell(c + 2), numero(cap?.mejor_nota), cap?.aprobado === true)
    }
  })
  aplicarAutofiltro(hoja, columnas.length, 10 + integrantes.length)
  agregarPie(hoja, 12 + integrantes.length, columnas.length,
    'Cada capítulo muestra su mejor nota registrada. El progreso de «Mi aprendizaje» es individual y no depende del aula.')
}

function crearCuestionarios(libro, reporte, integrantes) {
  const hoja = libro.addWorksheet('Cuestionarios')
  const columnas = [
    { clave: 'numero', nombre: 'N.º', ancho: 9 },
    { clave: 'nombre', nombre: 'INTEGRANTE', ancho: 34 },
    { clave: 'codigo', nombre: 'CUESTIONARIO', ancho: 17 },
    { clave: 'estado', nombre: 'ESTADO', ancho: 17 },
    { clave: 'nota', nombre: 'NOTA / 100', ancho: 17 },
    { clave: 'aciertos', nombre: 'ACIERTOS / 12', ancho: 17 },
    { clave: 'limite', nombre: 'FECHA LÍMITE', ancho: 25 },
    { clave: 'entrega', nombre: 'FECHA DE ENTREGA', ancho: 27 },
  ]
  configurarHoja(hoja, {
    titulo: 'CENTINELA DIGITAL · CUESTIONARIOS A, B Y C',
    subtitulo: 'Entregas, calificaciones y fechas de cada integrante',
    codigo: reporte?.aula?.codigo || '', columnas, nombrePestana: 'Cuestionarios',
  })
  hoja.mergeCells(6, 1, 6, columnas.length)
  hoja.getCell('A6').value = 'Cada estudiante tiene como máximo una entrega por cuestionario asignado.'
  hoja.getCell('A6').font = { name: 'Aptos', size: 10, color: { argb: `FF${COLORES.azulClaro}` }, bold: true }
  hoja.getRow(6).height = 23
  let idx = 11
  integrantes.forEach((p) => {
    const tareas = Array.isArray(p.tareas) ? p.tareas : []
    ;['A', 'B', 'C'].forEach((codigo) => {
      const tarea = tareas.find((t) => t.codigo === codigo)
      const fila = hoja.getRow(idx)
      fila.values = [
        null, String(p.numero ?? '').padStart(2, '0'), limpiarTexto(p.nombre || 'Sin nombre'),
        codigo, estadoTarea(tarea?.estado),
        tarea?.entregado ? numero(tarea.nota) : null,
        tarea?.entregado ? numero(tarea.aciertos) : null,
        fechaExcel(tarea?.fecha_limite), fechaExcel(tarea?.fecha_entrega),
      ]
      pintarFila(hoja, idx, columnas.length)
      const [fondo, texto] = tonoEstado(tarea?.estado)
      rellenar(fila.getCell(4), fondo, texto, true)
      fila.getCell(4).alignment = { horizontal: 'center', vertical: 'middle' }
      notaColoreada(fila.getCell(5), tarea?.entregado ? numero(tarea.nota) : null)
      fila.getCell(6).value = tarea?.entregado ? `${tarea.aciertos ?? '—'}/12` : '—'
      fila.getCell(6).alignment = { horizontal: 'center', vertical: 'middle' }
      idx += 1
    })
  })
  aplicarAutofiltro(hoja, columnas.length, idx - 1)
  agregarPie(hoja, idx + 1, columnas.length,
    'Solo los cuestionarios entregados reciben calificación. El Test 2026 imprimible es un documento independiente.')
}

export async function exportarExcelSeguimiento(reporte) {
  if (!reporte || !Array.isArray(reporte.integrantes)) {
    throw new Error('No hay datos válidos para exportar.')
  }
  // La librería se descarga solo al presionar el botón; no retrasa la pantalla de seguimiento.
  const modulo = await import('exceljs/dist/exceljs.min.js')
  const ExcelJS = modulo.default || modulo
  if (typeof ExcelJS.Workbook !== 'function') {
    throw new Error('No pudo cargarse la librería de Excel.')
  }
  const libro = new ExcelJS.Workbook()
  libro.creator = 'CENTINELA DIGITAL'
  libro.subject = 'Reporte institucional de seguimiento académico por aula'
  libro.title = 'Programa Centinela de la Salud · Seguimiento académico'
  libro.created = new Date()
  const integrantes = [...reporte.integrantes].sort((a, b) => Number(a.numero) - Number(b.numero))
  crearResumen(libro, reporte, integrantes)
  crearCapitulos(libro, reporte, integrantes)
  crearCuestionarios(libro, reporte, integrantes)

  const buffer = await libro.xlsx.writeBuffer()
  const archivo = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  const url = URL.createObjectURL(archivo)
  const enlace = document.createElement('a')
  const codigo = String(reporte?.aula?.codigo || 'aula').replace(/[^A-Za-z0-9_-]/g, '')
  enlace.href = url
  enlace.download = `CENTINELA_SEGUIMIENTO_${codigo}.xlsx`
  document.body.appendChild(enlace)
  enlace.click()
  enlace.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 3000)
}
