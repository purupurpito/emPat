/**
 * Valores fijos del motor: ajustes de serie, nombres de categoría y de cargo, lados y fases.
 * Las tablas con texto visible se escriben como una lista legible y se convierten en objeto al
 * cargar el módulo, para que añadir una fila sea editar una línea.
 * @module src/rules/constants.js
 */

/**
 * Convierte una tabla de texto "clave  valor" en un objeto congelado. Cada fila no vacía aporta
 * una entrada: la clave es la primera palabra y el valor, el resto de la línea sin espacios a los
 * lados. El orden de las filas se conserva porque la interfaz recorre estas tablas en orden.
 * @param {string} table filas separadas por saltos de línea
 * @returns {Readonly<Record<string, string>>}
 */
function readTable(table) {
    const entries = []
    for (const row of table.split("\n")) {
        const match = /^\s*(\S+)\s+(.+?)\s*$/.exec(row)
        if (match === null) {
            continue
        }
        entries.push([match[1], match[2]])
    }
    return Object.freeze(Object.fromEntries(entries))
}

/**
 * Ajustes de serie de un partido: al mejor de cinco, sets a 25, decisivo a 15, dos tiempos y seis
 * sustituciones por set, cambio de campo a los 8 puntos del decisivo y líbero permitido.
 * fullSetRule lo usa solo la interfaz; el motor no lo consulta. rosterLimit no figura: si falta,
 * el tope depende de si hay líbero.
 * @type {Readonly<{bestOf: number, setPoints: number, deciderPoints: number, timeouts: number,
 *     substitutions: number, deciderSwitch: number, liberoAllowed: boolean,
 *     fullSetRule: boolean}>}
 */
export const DEFAULT_SETTINGS = Object.freeze({
    bestOf: 5,
    setPoints: 25,
    deciderPoints: 15,
    timeouts: 2,
    substitutions: 6,
    deciderSwitch: 8,
    liberoAllowed: true,
    fullSetRule: false,
})

/**
 * Nombre visible de cada letra de categoría de jugador. Las letras son las que se imprimen en el
 * acta, por eso no se traducen a códigos nuevos.
 * @type {Readonly<Record<"Y"|"J"|"C"|"I"|"A", string>>}
 */
export const CATEGORY_NAMES = readTable(`
    Y   Júnior
    J   Juvenil
    C   Cadete
    I   Infantil
    A   Alevín`)

/**
 * Cargo visible de cada rol del cuerpo técnico (FIVB 4.1.1 y circular federativa de oficiales).
 * El orden de las filas es el de los desplegables de la plantilla.
 * @type {Readonly<Record<string, string>>}
 */
export const STAFF_TITLES = readTable(`
    coach          Entrenador
    assistant      Entrenador asistente
    assistant2     2º entrenador asistente
    physio         Fisioterapeuta
    doctor         Médico
    psychologist   Psicólogo
    fitness        Preparador físico
    masseur        Masajista`)

/**
 * Los dos lados del partido, en el orden en que se recorren siempre: local y visitante.
 * @type {ReadonlyArray<"home"|"away">}
 */
export const SIDES = Object.freeze(["home", "away"])

/**
 * Fases del partido. setup: preparación; live: set en juego; break: entre sets, con el periodo
 * siguiente ya creado pero sin empezar; over: partido terminado.
 * @type {Readonly<{setup: "setup", live: "live", break: "break", over: "over"}>}
 */
export const PHASE = Object.freeze({
    setup: "setup",
    live: "live",
    break: "break",
    over: "over",
})

/**
 * Lado contrario. Cualquier valor que no sea "home" se trata como visitante y devuelve "home":
 * así se comporta el motor con lados mal formados, y las pruebas diferenciales lo exigen.
 * @param {unknown} side lado de partida
 * @returns {"home"|"away"}
 */
export function rival(side) {
    if (side === "home") {
        return "away"
    }
    return "home"
}

/**
 * Indica si un valor es uno de los dos lados válidos. Sirve para rechazar jugadas con un lado
 * desconocido sin depender de rival, que nunca falla.
 * @param {unknown} value valor a comprobar
 * @returns {boolean}
 */
export function isSide(value) {
    return SIDES.includes(value)
}
