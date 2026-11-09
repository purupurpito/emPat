/**
 * Formatos de texto de la interfaz: horas, nombres propios y etiquetas cortas.
 * @module src/app/format.js
 */

/**
 * Opciones de hora corta: horas y minutos con dos cifras.
 */
const CLOCK_OPTIONS = Object.freeze({ hour: "2-digit", minute: "2-digit" })

/**
 * Hora local HH:MM de una marca ISO, con el formato peninsular sea cual sea el idioma, porque
 * en el acta impresa y en pantalla tienen que coincidir.
 * @param {string|null|undefined} iso marca
 * @returns {string} cadena vacía si no hay marca
 */
export function clockTime(iso) {
    if (!iso) {
        return ""
    }
    return new Date(iso).toLocaleTimeString("es-ES", CLOCK_OPTIONS)
}

/**
 * Pone en mayúscula la primera letra de cada palabra y en minúscula el resto. Una palabra
 * empieza al principio o tras espacio, apóstrofo, punto volado, paréntesis o guion, para que
 * "d'ors" y "garcía-pons" queden bien.
 * @param {unknown} text texto
 * @returns {string}
 */
export function properCase(text) {
    const lower = String(text || "").toLowerCase()
    return lower.replace(/(?<=^|[\s'·(-])\p{L}/gu, (letter) => letter.toUpperCase())
}

/**
 * Primera palabra de un nombre, cortada a once caracteres, para las casillas estrechas.
 * @param {unknown} text nombre completo
 * @returns {string}
 */
export function shortLabel(text) {
    const words = String(text || "").split(" ")
    for (const word of words) {
        if (word !== "") {
            return word.slice(0, 11)
        }
    }
    return ""
}

/**
 * Ordinales cortos de set por idioma; la posición cero no se usa.
 * @type {Readonly<{es: string[], ca: string[]}>}
 */
export const ORDINALS = Object.freeze({
    es: Object.freeze(["", "1er", "2º", "3er", "4º", "5º", "6º"]),
    ca: Object.freeze(["", "1r", "2n", "3r", "4t", "5è", "6è"]),
})
