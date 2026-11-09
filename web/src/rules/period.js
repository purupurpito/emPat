/**
 * Estado de un periodo (set): alineación, rotación, marcador, turnos de saque y todo lo que se
 * cuenta por set.
 * @module src/rules/period.js
 */

import { rival } from "./constants.js"

/** Zona en la que el líbero ya estaría en la delantera tras girar (zona IV). */
const FRONT_ENTRY_ZONE = 3

/**
 * Crea un par {home, away} cuyos valores salen de una fábrica, para que cada lado tenga su
 * propio objeto y nunca compartan una lista o un conjunto.
 * @param {() => unknown} make fábrica del valor inicial
 * @returns {{home: unknown, away: unknown}}
 */
function perSide(make) {
    return { home: make(), away: make() }
}

/**
 * Un set del partido. Contiene sus contadores y la rotación de ambos lados; el partido decide
 * cuándo se crea y cuándo se cierra. La rotación nunca incluye al líbero: guarda al jugador al
 * que sustituye, y el líbero va aparte con su zona.
 */
export class Period {
    /**
     * Crea un periodo vacío.
     * @param {number} number número de set
     * @param {boolean} decider si es el decisivo
     */
    constructor(number, decider) {
        this.number = number
        this.decider = decider
        this.isGolden = false
        this.startedAt = null
        this.endedAt = null
        this.firstServer = null
        this.leftSide = null
        this.serving = null
        this.winner = null
        this.switched = false
        this.rallyCount = 0
        this.lineup = perSide(() => null)
        this.rotation = perSide(() => null)
        this.libero = perSide(() => null)
        this.score = perSide(() => 0)
        this.turns = perSide(() => [])
        this.substitutions = perSide(() => [])
        this.partners = perSide(() => ({}))
        this.closed = perSide(() => new Set())
        this.hasPlayed = perSide(() => new Set())
        this.expelled = perSide(() => new Set())
        this.timeouts = perSide(() => [])
        this.liberoSwaps = perSide(() => [])
        this.rallyLog = []
        this.replays = []
        this.actingCaptain = perSide(() => null)
        this.lastLiberoRally = perSide(() => -1)
        this.mustReplace = perSide(() => [])
        this.subCount = perSide(() => 0)
    }

    /**
     * Marcador visto desde un lado: own es el del lado pedido y rival el del contrario.
     * @param {"home"|"away"} side lado
     * @returns {{own: number, rival: number}}
     */
    scoreFor(side) {
        return { own: this.score[side], rival: this.score[rival(side)] }
    }

    /**
     * Seis dorsales visibles de un lado: la rotación con el líbero en la zona que ocupa. Sin
     * alineación devuelve una lista vacía.
     * @param {"home"|"away"} side lado
     * @returns {string[]}
     */
    visible(side) {
        const order = this.rotation[side] || []
        const libero = this.libero[side]
        return order.map((shirt, zone) => pickVisible(libero, shirt, zone))
    }

    /**
     * Gira la rotación de un lado una posición (FIVB 7.6). Si el líbero llega así a la
     * delantera sale solo (FIVB 19.3.1.3): vuelve el jugador al que sustituía y queda constancia
     * como salida automática, con el marcador ya actualizado.
     * @param {"home"|"away"} side lado
     * @param {Match} match partido, donde se apuntan las salidas automáticas
     * @param {string|null} at marca de tiempo ISO
     */
    rotate(side, match, at) {
        const order = this.rotation[side]
        this.rotation[side] = [...order.slice(1), order[0]]
        const libero = this.libero[side]
        if (!libero) {
            return
        }
        libero.zone = (libero.zone + 5) % 6
        if (libero.zone !== FRONT_ENTRY_ZONE) {
            return
        }
        match.automatic.push({
            kind: "liberoAutoOut",
            side,
            period: this.number,
            libero: libero.shirt,
            back: libero.replacing,
            at,
        })
        // En el registro de cambios del líbero esta salida no lleva hora: la marca va en automatic.
        this.liberoSwaps[side].push({
            entering: libero.replacing,
            leaving: libero.shirt,
            ...this.scoreFor(side),
            auto: true,
        })
        this.libero[side] = null
        this.lastLiberoRally[side] = this.rallyCount
    }

    /**
     * Abre un turno de saque para el jugador de la zona I. since guarda los puntos propios al
     * recuperar el saque, que es donde empieza la casilla del acta.
     * @param {"home"|"away"} side lado
     */
    openTurn(side) {
        const server = this.rotation[side][0]
        let column = this.lineup[side].indexOf(server)
        if (column < 0) {
            column = this.columnOf(side, server)
        }
        this.turns[side].push({ column, server, until: null, since: this.score[side] })
    }

    /**
     * Cierra el último turno de saque si sigue abierto, con los puntos propios de ese momento.
     * @param {"home"|"away"} side lado
     */
    closeTurn(side) {
        const turns = this.turns[side]
        const last = turns[turns.length - 1]
        if (!last) {
            return
        }
        if (last.until === null || last.until === undefined) {
            last.until = this.score[side]
        }
    }

    /**
     * Columna del acta en la que se anota a un sacador suplente: la del titular por el que
     * entró, o -1 si no consta pareja.
     * @param {"home"|"away"} side lado
     * @param {string} shirt dorsal
     * @returns {number}
     */
    columnOf(side, shirt) {
        const pairs = this.partners[side]
        const starter = Object.keys(pairs).find((key) => pairs[key] === shirt)
        if (starter === undefined) {
            return -1
        }
        return this.lineup[side].indexOf(starter)
    }
}

/**
 * Dorsal que se ve en una zona: el del líbero si está allí, si no el de la rotación.
 * @param {{shirt: string, zone: number}|null} libero líbero en pista
 * @param {string} shirt dorsal de la rotación
 * @param {number} zone índice de zona
 * @returns {string}
 */
function pickVisible(libero, shirt, zone) {
    if (libero && libero.zone === zone) {
        return libero.shirt
    }
    return shirt
}
