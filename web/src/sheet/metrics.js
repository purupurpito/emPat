/**
 * Medidas de texto para el acta impresa. El papel se compone sin navegador (también en Node),
 * así que el ancho de cada letra se estima con tres anchos fijos de Arial en lugar de medirse.
 * @module src/sheet/metrics.js
 */

const WIDE_GLYPH = /[A-ZÀ-ÖØ-Þ0-9]/

/**
 * Unidades de diseño por cuerpo en Arial.
 */
const EM_UNITS = 2048

/**
 * Milímetros que ocupa un punto tipográfico.
 */
const MM_PER_PT = 25.4 / 72

/**
 * Avance de un carácter en unidades de Arial: mayúsculas y cifras, un ancho medio holgado; el
 * espacio, el suyo; el resto, un ancho medio de minúscula.
 * @param {string} glyph un carácter
 * @returns {number}
 */
function glyphAdvance(glyph) {
    if (WIDE_GLYPH.test(glyph)) {
        return 1393
    }
    if (glyph === " ") {
        return 573
    }
    return 1065
}

/**
 * Ancho aproximado que ocupa un texto en Arial. No consulta ninguna fuente: es una estimación
 * estable, igual en cualquier máquina, que basta para decidir si hay que estrechar o partir.
 * @param {unknown} text texto (se convierte con String)
 * @param {number} size cuerpo en puntos
 * @returns {number} ancho en mm
 */
export function estimateWidth(text, size) {
    let units = 0
    for (const glyph of String(text)) {
        units += glyphAdvance(glyph)
    }
    return units / EM_UNITS * size * MM_PER_PT
}

/**
 * Parte un texto por palabras en renglones que no pasan de `width`. Una palabra que no cabe
 * sola en un renglón vacío se deja entera: nunca se corta una palabra.
 * @param {unknown} text texto
 * @param {number} width ancho máximo en mm
 * @param {number} size cuerpo en puntos
 * @returns {string[]} renglones
 */
export function wrapWords(text, width, size) {
    const rows = []
    let current = ""
    const words = String(text).split(/\s+/).filter(Boolean)
    for (const word of words) {
        let attempt = word
        if (current) {
            attempt = current + " " + word
        }
        if (!current || estimateWidth(attempt, size) <= width) {
            current = attempt
            continue
        }
        rows.push(current)
        current = word
    }
    if (current) {
        rows.push(current)
    }
    return rows
}

/**
 * Hora local "HH:MM" con el formato español, o cadena vacía si no hay marca de tiempo.
 * @param {string|null|undefined} iso instante ISO
 * @returns {string}
 */
export function sheetTime(iso) {
    if (!iso) {
        return ""
    }
    const options = { hour: "2-digit", minute: "2-digit" }
    return new Date(iso).toLocaleTimeString("es-ES", options)
}

/**
 * Fecha "D/M/AAAA" sin ceros a la izquierda a partir de "AAAA-MM-DD". Cualquier otro texto se
 * devuelve tal cual, para no perder lo que se escribiera a mano.
 * @param {string|null|undefined} iso fecha
 * @returns {string}
 */
export function shortDate(iso) {
    const text = String(iso || "")
    const parts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text)
    if (!parts) {
        return text
    }
    return `${Number(parts[3])}/${Number(parts[2])}/${parts[1]}`
}

/**
 * Minutos redondeados entre dos instantes ISO.
 * @param {string} from inicio
 * @param {string} to fin
 * @returns {number}
 */
export function spanMinutes(from, to) {
    return Math.round((Date.parse(to) - Date.parse(from)) / 60000)
}
