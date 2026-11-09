/**
 * Colores de equipo: valores de serie, elección y contraste del texto.
 * @module src/app/colors.js
 */

/**
 * Colores de serie de camisetas y líberos, por clave de datos.
 * @type {Readonly<Record<string, string>>}
 */
const DEFAULT_COLORS = Object.freeze({
    homeColor: "#1F3A93",
    awayColor: "#FFFFFF",
    homeLiberoColor: "#16A34A",
    awayLiberoColor: "#DB2777",
})

/**
 * Pesos de cada canal en la luminancia relativa.
 */
const CHANNEL_WEIGHTS = Object.freeze([0.2126, 0.7152, 0.0722])

/**
 * Color guardado en los datos si es un hexadecimal completo; si no, el de serie. Así un dato
 * corrupto o vacío nunca llega al estilo.
 * @param {object|null|undefined} info datos
 * @param {string} key clave de color
 * @returns {string}
 */
export function pickColor(info, key) {
    const stored = info?.[key] || ""
    if (/^#[0-9a-f]{6}$/i.test(stored)) {
        return info[key]
    }
    return DEFAULT_COLORS[key]
}

/**
 * Color de un lado, del equipo o de su líbero.
 * @param {object|null|undefined} info datos
 * @param {"home"|"away"} side lado
 * @param {boolean} [libero] color del líbero
 * @returns {string}
 */
export function teamColor(info, side, libero) {
    const suffix = libero ? "LiberoColor" : "Color"
    return pickColor(info, side + suffix)
}

/**
 * Componente lineal de un canal de color sRGB.
 * @param {string} pair dos cifras hexadecimales
 * @returns {number}
 */
function linearChannel(pair) {
    const value = parseInt(pair, 16) / 255
    if (value <= 0.03928) {
        return value / 12.92
    }
    return ((value + 0.055) / 1.055) ** 2.4
}

/**
 * Color de texto legible sobre un fondo: negro sobre claros y blanco sobre oscuros, según la
 * luminancia relativa.
 * @param {string} background color #rrggbb
 * @returns {"#000"|"#fff"}
 */
export function inkFor(background) {
    let luminance = 0
    for (const [index, weight] of CHANNEL_WEIGHTS.entries()) {
        const start = 1 + index * 2
        luminance += weight * linearChannel(background.slice(start, start + 2))
    }
    if (luminance > 0.18) {
        return "#000"
    }
    return "#fff"
}

/**
 * Declaraciones de variables CSS para pintar una ficha con el color del equipo y un texto que
 * se lea encima.
 * @param {object|null|undefined} info datos
 * @param {"home"|"away"} side lado
 * @param {boolean} [libero] color del líbero
 * @returns {string}
 */
export function colorVars(info, side, libero) {
    const fill = teamColor(info, side, libero)
    return `--chip-bg:${fill};--chip-ink:${inkFor(fill)}`
}
