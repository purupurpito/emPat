/**
 * Fotografía comparable del estado de un partido. Convierte los Set y los Map en listas que
 * conservan el orden de inserción, de modo que dos estados construidos por caminos distintos solo
 * coinciden si son iguales también en ese orden.
 * @module tests/support/snapshot.mjs
 */

/**
 * Sustituto de JSON.stringify para colecciones que JSON no sabe representar.
 * @param {string} key clave (no se usa)
 * @param {unknown} value valor
 * @returns {unknown}
 */
function encodeCollections(key, value) {
    if (value instanceof Set) {
        return { "<set>": [...value] }
    }
    if (value instanceof Map) {
        return { "<map>": [...value] }
    }
    return value
}

/**
 * Texto que representa el estado completo.
 * @param {object} match partido
 * @returns {string}
 */
export function snapshot(match) {
    return JSON.stringify(match, encodeCollections)
}

/**
 * Primer camino (a.b[3].c) en que dos fotografías difieren, para que el fallo diga dónde mirar.
 * @param {string} left fotografía
 * @param {string} right fotografía
 * @returns {string|null} camino o null si son iguales
 */
export function firstDifference(left, right) {
    if (left === right) {
        return null
    }
    return walkDifference(JSON.parse(left), JSON.parse(right), "")
}

/**
 * Busca recursivamente la primera diferencia entre dos valores ya decodificados.
 * @param {unknown} left valor
 * @param {unknown} right valor
 * @param {string} path camino hasta aquí
 * @returns {string|null}
 */
function walkDifference(left, right, path) {
    if (typeof left !== "object" || typeof right !== "object" || left === null || right === null) {
        return Object.is(left, right) ? null : path || "(raíz)"
    }
    const keys = new Set([...Object.keys(left), ...Object.keys(right)])
    for (const key of keys) {
        const found = walkDifference(left[key], right[key], path + "." + key)
        if (found !== null) {
            return found
        }
    }
    return null
}
