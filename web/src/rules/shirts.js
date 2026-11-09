/**
 * Dorsales: validación y forma canónica. Un dorsal es un número de una o dos cifras y siempre se
 * guarda como texto, porque "00" y "0" son dorsales distintos y un número no puede distinguirlos.
 * Es el único sitio del código que convierte un dorsal a número.
 * @module src/rules/shirts.js
 */

/**
 * Forma válida de un dorsal: una o dos cifras.
 * @type {RegExp}
 */
export const SHIRT_RE = /^\d{1,2}$/

/** Campos de una jugada que contienen siempre un dorsal. */
const SHIRT_FIELDS = Object.freeze(["leaving", "entering", "libero", "shirt", "successor"])

/**
 * Indica si un valor cualquiera, una vez recortado, tiene forma de dorsal. Acepta números y
 * textos con espacios alrededor; null y undefined cuentan como texto vacío.
 * @param {unknown} value valor escrito por el usuario o leído de una jugada
 * @returns {boolean}
 */
export function isValidShirt(value) {
    const text = String(value ?? "").trim()
    return SHIRT_RE.test(text)
}

/**
 * Lleva un dorsal a su forma canónica: sin espacios y sin ceros a la izquierda ("07" y 7 pasan a
 * "7"), salvo "00", que se conserva. Un texto sin forma de dorsal se devuelve recortado pero sin
 * más cambios, para que la regla correspondiente pueda rechazarlo con su propio mensaje. Los
 * valores vacíos (null, undefined y "") se devuelven tal cual: ausencia no es lo mismo que error.
 * @param {unknown} value dorsal en cualquier forma
 * @returns {unknown} el dorsal canónico, el texto recortado o el valor vacío original
 */
export function normalizeShirt(value) {
    if (value === null || value === undefined || value === "") {
        return value
    }
    const text = String(value).trim()
    if (text === "00") {
        return text
    }
    if (!SHIRT_RE.test(text)) {
        return text
    }
    return String(Number(text))
}

/**
 * Indica si un valor ya es un dorsal en forma de texto. No recorta ni convierte: sirve para
 * distinguir un dorsal de un rol o de "team" en el destinatario de una sanción.
 * @param {unknown} value valor a comprobar
 * @returns {boolean}
 */
export function isShirt(value) {
    if (typeof value !== "string") {
        return false
    }
    return SHIRT_RE.test(value)
}

/**
 * Indica si el destinatario de una sanción debe tratarse como dorsal: un número o un texto con
 * forma de dorsal. Los roles y "team" quedan fuera y no se tocan.
 * @param {unknown} target destinatario
 * @returns {boolean}
 */
function targetLooksLikeShirt(target) {
    if (typeof target === "number") {
        return true
    }
    return SHIRT_RE.test(String(target))
}

/**
 * Devuelve una copia superficial de la jugada con todos sus dorsales en forma canónica. No
 * modifica la jugada recibida, que pertenece al acta guardada. Solo toca los campos presentes;
 * la alineación se normaliza elemento a elemento.
 * @param {object} play jugada tal como llega del acta o de la interfaz
 * @returns {object} copia con los dorsales normalizados
 */
export function normalizePlay(play) {
    const copy = { ...play }
    for (const field of SHIRT_FIELDS) {
        if (field in copy) {
            copy[field] = normalizeShirt(copy[field])
        }
    }
    if ("target" in copy && targetLooksLikeShirt(copy.target)) {
        copy.target = normalizeShirt(copy.target)
    }
    if (copy.kind === "lineup" && Array.isArray(copy.shirts)) {
        copy.shirts = copy.shirts.map(normalizeShirt)
    }
    return copy
}
