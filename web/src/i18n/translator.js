/**
 * Traductor de una pasada sobre el catálogo catalán.
 * @module src/i18n/translator.js
 */

import { escapeRegex } from "./ca.js"

/** Un texto sin ninguna letra (cifras, signos, marcadores) se deja como está. */
const HAS_LETTER = /[a-záéíóúñ]/i

/**
 * Ajuste final de la Circular de la FCVB: la figura se llama "Lliure" en catalán. Va en este
 * orden para que el plural se resuelva primero y el singular después. El límite de palabra es
 * el ASCII, así que la tilde cuenta como separador: "xLíbero" no cambia y "Líbero" sí.
 */
const LIBERO_WORDS = [
    [/\bLíberos\b/g, "Lliures"],
    [/\blíberos\b/g, "lliures"],
    [/\bLíbero\b/g, "Lliure"],
    [/\blíbero\b/g, "lliure"],
]

/**
 * Expresión que localiza un trozo como palabra completa. La letra o cifra que lo precede se
 * captura (en vez de mirar hacia atrás) y se devuelve intacta al reemplazar.
 * @param {string} piece trozo castellano
 * @returns {RegExp}
 */
function wholeWords(piece) {
    const edge = "[^\\p{L}\\p{N}]"
    return new RegExp("(^|" + edge + ")" + escapeRegex(piece) + "(?=$|" + edge + ")", "gu")
}

/**
 * Crea el traductor al catalán. Hace una sola pasada: si el resultado aún contiene castellano
 * traducible, no vuelve a intentarlo (eso lo decide quien lo llama).
 *
 * Orden: texto completo; si no, el primer patrón que encaje; si no, todos los trozos en
 * cadena. Siempre se aplica después el ajuste de "líbero". El resultado sustituye al texto sin
 * espacios dentro del original, así que los espacios de alrededor se conservan.
 * @param {{LITERALS: Map<string, string>, PATTERNS: ReadonlyArray<object>,
 *     FRAGMENTS: ReadonlyArray<readonly [string, string]>}} catalog catálogo; cada patrón lleva
 *     su expresión anclada (pattern) y la función que compone el catalán (fill)
 * @returns {{t: (text: unknown) => unknown}} t devuelve lo que no sea texto sin tocar
 */
export function createTranslator(catalog) {
    const fragments = []
    for (const [piece, replacement] of catalog.FRAGMENTS) {
        fragments.push({ finder: wholeWords(piece), replacement })
    }

    function byPattern(core) {
        for (const { pattern, fill } of catalog.PATTERNS) {
            const found = core.match(pattern)
            if (found !== null) {
                return fill(found, t)
            }
        }
        return undefined
    }

    function byFragments(core) {
        let result = core
        for (const { finder, replacement } of fragments) {
            result = result.replace(finder, (whole, before) => before + replacement)
        }
        return result
    }

    function t(text) {
        if (typeof text !== "string") {
            return text
        }
        const core = text.trim()
        if (core === "" || !HAS_LETTER.test(core)) {
            return text
        }
        let result = catalog.LITERALS.get(core) ?? byPattern(core) ?? byFragments(core)
        for (const [word, replacement] of LIBERO_WORDS) {
            result = result.replace(word, replacement)
        }
        if (result === core) {
            return text
        }
        // Reemplazo con cadena a propósito: los patrones "$" del resultado se interpretan como
        // en cualquier String#replace, y la conducta en pantalla depende de ello.
        return text.replace(core, result)
    }

    return { t }
}
