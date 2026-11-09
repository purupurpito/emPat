/**
 * Geometría de los impresos de la federación, en milímetros sobre la página A4 y con el origen
 * en su esquina superior izquierda. Las medidas salen de los propios SVG de impresos/: las
 * rayas de la cuadrícula dan los bordes de cada casilla y la tinta de los rótulos impresos da
 * las líneas base y los centros; lo que no coincide con una raya se separa de ella con una
 * holgura de décimas de milímetro. Se escriben como tablas de texto: cada línea es
 * `ruta.de.la.clave valor valor …`.
 * @module src/sheet/layout.js
 */

/**
 * Convierte una tabla de medidas en un objeto. Una clave con un solo valor da un número; con
 * varios, una lista. Las líneas que empiezan por # son notas.
 * @param {string} table tabla
 * @returns {object}
 */
function parseGeometry(table) {
    const root = {}
    for (const line of table.split("\n")) {
        const words = line.trim().split(/\s+/)
        if (words[0] === "" || words[0].startsWith("#")) {
            continue
        }
        const path = words[0].split(".")
        const leaf = path.pop()
        let node = root
        for (const key of path) {
            node[key] ??= {}
            node = node[key]
        }
        const values = words.slice(1).map(parseFloat)
        if (values.length === 1) {
            node[leaf] = values[0]
        } else {
            node[leaf] = values
        }
    }
    return root
}

/**
 * Agrupa una lista plana de `size` en `size`.
 * @param {number[]} flat valores
 * @param {number} size tamaño de cada grupo
 * @returns {number[][]}
 */
function inGroups(flat, size) {
    const groups = []
    for (let i = 0; i < flat.length; i += size) {
        groups.push(flat.slice(i, i + size))
    }
    return groups
}

/**
 * Congela un objeto y todo lo que cuelga de él.
 * @template T
 * @param {T} value objeto
 * @returns {T}
 */
function deepFreeze(value) {
    if (value && typeof value === "object") {
        for (const inner of Object.values(value)) {
            deepFreeze(inner)
        }
        Object.freeze(value)
    }
    return value
}

// Cabecera, letras A/B de la cabecera y árbitros: iguales en los dos modelos. Los renglones
// son [x, base, ancho]: empiezan un poco después del rótulo impreso, comparten su línea base y
// acaban antes del rótulo o la raya siguiente.
const SHARED = parseGeometry(`
    head.competition 24.78 6.43 107.67
    head.date 143.63 7.15 25.4
    head.hour 180.54 7.32 7.16
    head.minute 189.46 7.32 7.8
    head.home 22.59 12.18 75.39
    head.away 118.9 12.31 78.54
    head.venue 32.15 17.8 164.35
    # centro de la tinta de la A y la B impresas junto a cada equipo
    letters.home.A 14.9 11.07
    letters.home.B 20.24 11.07
    letters.away.A 110.98 11.2
    letters.away.B 116.36 11.2
    letters.radius 1.85
    # árbitros y anotador: bases de los rótulos 1r AR., 2n AR. y ANOT.; nombre y licencia [x, ancho]
    officials.bases 178.99 185.38 192.65
    officials.name 55.81 47.89
    officials.licence 104.75 17.46
    officials.licenceLift 1`)

// Inscripción del modelo estándar: 14 filas y oficiales en cuatro renglones. Columnas
// [x, ancho] entre rayas, letra en el centro del anillo impreso, abreviatura [x, y, ancho, alto]
// y renglones de oficiales [y, alto].
const STANDARD_ROSTER = parseGeometry(`
    rows.top 118.82
    rows.step 4.257
    rows.count 14
    home.shirt 219.3 4.61
    away.shirt 256.95 4.82
    home.name 223.91 33.05
    away.name 261.77 32.98
    home.letter 248.33 113.12
    away.letter 265.45 113.12
    home.code 220.85 110.94 24.7 4.25
    away.code 268.42 110.94 24.7 4.25
    home.staff 220.13 32.53
    away.staff 261.64 32.62
    staffRows 180.47 3.55 184.02 2.96 186.98 3.3 190.28 3.28`)

// Inscripción del modelo infantil: 12 filas más altas y oficiales en tres renglones.
const KIDS_ROSTER = parseGeometry(`
    rows.top 118.82
    rows.step 4.99
    rows.count 12
    home.shirt 218.54 5.39
    away.shirt 257.59 5.03
    home.name 226.63 30.95
    away.name 265.32 31.27
    home.letter 248.94 113.23
    away.letter 266.23 113.23
    home.code 220.09 111.3 24.7 4.25
    away.code 269.22 111.3 24.7 4.25
    home.staff 219.44 33.7
    away.staff 262.31 33.78
    staffRows 180.75 4.5 185.25 4.27 189.52 4.46`)

/**
 * Monta la geometría completa de un modelo a partir de su inscripción.
 * @param {object} roster medidas de la inscripción
 * @returns {object}
 */
function buildLayout(roster) {
    return deepFreeze({
        ...structuredClone(SHARED),
        roster: { ...structuredClone(roster), staffRows: inGroups(roster.staffRows, 2) },
    })
}

/**
 * Geometría del modelo estándar (impresos/acta-estandar.svg).
 */
export const STANDARD_LAYOUT = buildLayout(STANDARD_ROSTER)

/**
 * Geometría del modelo infantil. Solo cambia la inscripción; el resto se dibuja con las
 * medidas del estándar y lo traslada la deformación (warp.js).
 */
export const KIDS_LAYOUT = buildLayout(KIDS_ROSTER)

const PERIOD_TABLE = parseGeometry(`
    # desplazamiento de cada set respecto al set 1 y de la mitad derecha respecto a la izquierda
    shift.1 0 0
    shift.2 146.14 0
    shift.3 0 45.75
    shift.4 146.14 45.75
    half 69.18
    # rayas de las columnas I a VI (siete bordes; el último es también el borde izquierdo de
    # PUNTS) y rayas que parten cada columna en las dos subcolumnas de saque
    columns 10.52 20.49 30.26 39.92 49.8 59.61 69.12
    splits 15.63 25.4 35.17 44.94 54.7 64.47
    # rayas de arriba de cada fila y paso de las filas de saque
    rows.head 18.77
    rows.lineup 27.91
    rows.entering 32.52
    rows.enterScore 37.08
    rows.backScore 41.65
    rows.serve 46.22
    serveStep 4.57
    # horas [inicio de la casilla de la hora, centro de los dos puntos impresos, base del rótulo]
    clock.start 16.28 22.86 22.79
    clock.end 124.74 131.33 22.5
    # duración [x, y, ancho, alto] bajo el rótulo MIN
    minutes 2.99 58.47 7.53 5.91
    # abreviatura del equipo tras EQUIP A / EQUIP B: base y [x, ancho]
    code.base 22.92
    code.left 42.31 22.62
    code.right 92.44 22.24
    # casillas S/R de quién saca primero: rayas izquierda y derecha
    firstServe.left 65.27 69.12
    firstServe.right 115.13 118.98
    # tiempos de descanso bajo la T: [y, alto] de cada casilla
    timeouts 55.35 4.57 59.92 4.61
    # columna PUNTS: centro x de cada subcolumna (1-13, 14-25, 26-37), centro y de su primer
    # número y paso entre números
    points.x 70.85 74.07 77.55
    points.y 24.91 24.91 24.87
    points.step 2.03 2.213 2.22`)

/**
 * Bordes izquierdo y derecho de la columna PUNTS de la mitad izquierda del set 1: la última
 * raya de las columnas y la primera de la mitad derecha.
 */
const PUNTS_EDGES = [
    PERIOD_TABLE.columns[6],
    PERIOD_TABLE.columns[0] + PERIOD_TABLE.half,
]

/**
 * Rejilla de los sets 1 a 4 (medida sobre el set 1).
 */
export const PERIOD_GRID = deepFreeze({
    ...PERIOD_TABLE,
    punts: PUNTS_EDGES,
    timeouts: inGroups(PERIOD_TABLE.timeouts, 2),
    points: {
        ...PERIOD_TABLE.points,
        first: [1, 14, 26],
        last: [13, 25, 37],
    },
})

/**
 * Rejilla del set decisivo, que va en tres partes: el primer equipo hasta el cambio de campo,
 * el otro equipo entero y el primero después del cambio.
 */
export const DECIDER_GRID = deepFreeze(parseGeometry(`
    # desplazamiento de las filas y de los números de PUNTS respecto al set 1
    rowsShift 91.51
    pointsShift 91.62
    headY 110.24
    # desplazamiento de cada parte respecto a la mitad izquierda del set 1: primera, otra, después
    parts 0.17 69.35 139.58
    # centros de los anillos de las letras A/B y de la cifra del cambio (el infantil, aparte)
    rings.first 41.43 112.58
    rings.other 91.03 112.58
    rings.after 161.37 112.58
    rings.switch 186.76 112.58
    kidsRings.first 37.68 113.28
    kidsRings.other 88.43 113.28
    kidsRings.after 158.66 113.11
    kidsRings.switch 183.61 113.11
    codes.base 114.38
    codes.first 44.09 20.5
    codes.other 93.99 39.38
    clock.start 16.49 23.03 114.21
    clock.end 197.88 203.22 114.38
    # infantil: INICI entera [x, base, ancho]; FINAL como las demás horas
    kidsClock.start 16.22 114.89 10.6
    kidsClock.end 194.72 200.46 115.14
    minutes 2.99 150.25 7.53 5.39
    firstServe.first 65.44 69.31
    firstServe.other 134.62 138.49
    # PUNTS 1-8 de la primera parte, antes del cambio: centro x, centro y del 1, paso y
    # media anchura del tramo que se anula
    early.x 74.55
    early.y 117.44
    early.step 2.362
    early.half 1.5`))

const FOOTER_TABLE = parseGeometry(`
    # sanciones: rayas de las columnas, raya de la primera fila, paso y filas disponibles;
    # tanteo propio y rival [x, ancho] a los lados de los dos puntos impresos
    sanctions.columns 2.95 8.15 13.35 18.57 23.77 28.97 34.17 45.4
    sanctions.top 186.39
    sanctions.step 4.228
    sanctions.count 5
    sanctions.own 34.17 5.09
    sanctions.rival 40.52 4.58
    # centros de los anillos de la A y la B de SOL·LICITUD IMPROCEDENT
    improper.A 27 179.35
    improper.B 40.42 179.35
    # cuadro de resultados: rayas y abreviaturas [x, y, ancho, alto]
    table.columns 163.76 170.69 176.86 183.04 191.66 200.29 206.46 212.64 219.23
    table.rows 165.04 169.6 174.17 178.78 183.35 187.91 192.67
    table.codeA 168.92 155.99 22.3 4.51
    table.codeB 196.17 155.99 22.57 4.51
    # horas, duración y ganador del modelo estándar [x, base, ancho]
    plain.start 168.96 196.82 12.39
    plain.end 186.42 196.9 15.19
    plain.total 206.38 196.9 12.66
    plain.winner 164.71 205.32 42.3
    plain.lost 212.73 205.32 5.3
    # lo mismo en el infantil: bordes de los dos puntos impresos y renglones en letra
    kids.base 197.94
    kids.start 174.35 175.04
    kids.end 193.29 193.99
    kids.total 211.17 211.86
    kids.winner 180.62 202.36 37.75
    kids.lost 189.08 206.91 24.7
    # RESULTATS: centro de cada barra impresa y base de los tanteos
    results.bars 79.59 98.11 117.16 136.52 155.09
    results.base 206.29
    # observaciones: renglones [x, base, ancho]; cuerpo de letra en puntos
    remarks.rows 28.19 159.92 134.78 3.88 164.28 159.09 3.88 168.85 159.09 3.88 173.46 159.09
    remarks.reserve 28.2
    remarks.size 7.2
    remarks.overflow 135.07 173.46 27.9
    remarks.end 3.88 173.61`)

/**
 * Rejilla del pie de la hoja: sanciones, cuadro de resultados, horas y observaciones.
 */
export const FOOTER_GRID = deepFreeze({
    ...FOOTER_TABLE,
    remarks: { ...FOOTER_TABLE.remarks, rows: inGroups(FOOTER_TABLE.remarks.rows, 3) },
})

/**
 * Hoja anexa vertical de observaciones (Format 5). Cada dato va 0,55 mm por encima de la base
 * de su línea de guiones y empieza un poco después del primer guion.
 */
export const ANNEX_GRID = deepFreeze(parseGeometry(`
    season.from 40.89 47.65 5
    season.to 53.35 47.65 5
    competition 35.32 63.97 71.2
    teams 30.98 72.47 75.84
    when 35.12 80.55 71.37
    place 30.21 88.66 75.68
    referee 25.73 105.29 53.28
    licence 48.37 110.07 8.2
    # renglones de la continuación: raya de cada uno, inicio, final y ancho útil
    lines.x 13.4
    lines.width 176.44
    lines.right 189.14
    lines.rows 140.23 147.1 152.65 159.52 165.86 172.73
    signedAt.town 107.62 259.72 21.12
    signedAt.day 134.01 259.72 5
    signedAt.month 144.28 259.72 30.94
    signedAt.year 181.17 259.72 10.79`))
