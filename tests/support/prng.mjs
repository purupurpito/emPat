/**
 * Azar reproducible para el fuzz: la misma semilla produce siempre la misma secuencia, así un
 * fallo se puede repetir y recortar.
 * @module tests/support/prng.mjs
 */

/**
 * Generador mulberry32: 32 bits de estado, rápido y suficiente para elegir jugadas.
 * @param {number} seed semilla entera
 * @returns {() => number} función que devuelve números en [0, 1)
 */
export function mulberry32(seed) {
    let state = seed >>> 0
    return function next() {
        state = (state + 0x6d2b79f5) >>> 0
        let mixed = state
        mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1)
        mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61)
        return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296
    }
}

/**
 * Elige una clave de una tabla de pesos. Los pesos no tienen que sumar 1: se reparten en
 * proporción. Con una tabla vacía devuelve undefined.
 * @param {() => number} rng generador
 * @param {Array<[string, number]>} table pares clave y peso
 * @returns {string|undefined}
 */
export function weighted(rng, table) {
    let total = 0
    for (const entry of table) {
        total += entry[1]
    }
    let ticket = rng() * total
    for (const entry of table) {
        ticket -= entry[1]
        if (ticket < 0) {
            return entry[0]
        }
    }
    return table.length > 0 ? table[table.length - 1][0] : undefined
}

/**
 * Elige un elemento cualquiera de una lista.
 * @template T
 * @param {() => number} rng generador
 * @param {T[]} list lista no vacía
 * @returns {T}
 */
export function pick(rng, list) {
    return list[Math.floor(rng() * list.length)]
}
