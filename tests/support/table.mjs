/**
 * Mesa de anotación para las pruebas: un constructor fluido que va añadiendo jugadas a un acta en
 * memoria, las valida con el motor al añadirlas y lleva un reloj simulado para que cada jugada
 * tenga su hora. El estado nunca se guarda: se reconstruye con replay en cada consulta,
 * igual que hace la aplicación.
 * @module tests/support/table.mjs
 */
import assert from "node:assert/strict"

/** Hora en que empieza el reloj simulado de cada mesa. */
const CLOCK_ORIGIN = Date.parse("2030-01-01T17:00:00Z")

/** Segundos que avanza el reloj simulado con cada jugada. */
const CLOCK_STEP_SECONDS = 24

/** Dorsales de la alineación de serie: del 1 al 6 en las zonas I a VI. */
const STARTERS = Object.freeze(["1", "2", "3", "4", "5", "6"])

/**
 * Plantilla de serie: dorsales 1 a 10 con el 1 de capitán, más los jugadores extra que se pidan.
 * @param {"home"|"away"} side lado
 * @param {object[]} [extras] jugadores añadidos al final, ya con la forma del motor
 * @returns {object} jugada roster
 */
function standardRoster(side, extras = []) {
    const players = []
    for (let shirt = 1; shirt <= 10; shirt += 1) {
        players.push({ shirt, name: "J" + side + shirt, captain: shirt === 1 })
    }
    return {
        kind: "roster",
        side,
        name: side === "home" ? "CV LOCAL" : "CV VISITANTE",
        players: players.concat(extras),
        staff: [{ role: "coach", name: "ENTRENADOR " + side }],
    }
}

/**
 * Jugador líbero con nombre de relleno.
 * @param {number|string} shirt dorsal
 * @param {string} name nombre
 * @returns {object}
 */
export function liberoPlayer(shirt, name) {
    return { shirt, name, libero: true }
}

/**
 * Pasa una lista de dorsales a texto, que es como los guarda el motor.
 * @param {Array<number|string>} shirts dorsales
 * @returns {string[]}
 */
export function asShirts(shirts) {
    return shirts.map(String)
}

/**
 * Busca la fila de un jugador en el informe de set completo. Admite el informe como lista por
 * lado o como objeto indexado por dorsal.
 * @param {object} report resultado de fullSetReport
 * @param {"home"|"away"} side lado
 * @param {string} shirt dorsal
 * @returns {object|undefined}
 */
export function fullSetRow(report, side, shirt) {
    const rows = report[side]
    if (Array.isArray(rows)) {
        return rows.find((row) => row.shirt === shirt)
    }
    return rows[shirt]
}

/**
 * Acta en construcción ligada a un motor.
 */
export class Table {
    #rules
    #settings
    #info
    #plays = []
    #clock = CLOCK_ORIGIN

    /**
     * Prepara una mesa vacía.
     * @param {object} rules motor (espacio de nombres de src/rules/index.js)
     * @param {object} [settings] ajustes del partido
     * @param {object} [info] datos del encuentro
     */
    constructor(rules, settings = {}, info = {}) {
        this.#rules = rules
        this.#settings = settings
        this.#info = info
    }

    /**
     * Partido listo para jugar el primer set: local con líberos 12 y 13, visitante con el 12,
     * sorteo con saque y lado izquierdo para el local y alineaciones 1 a 6 en los dos equipos.
     * @param {object} rules motor
     * @param {object} [settings] ajustes del partido
     * @returns {Table}
     */
    static ready(rules, settings = {}) {
        const table = new Table(rules, settings)
        table.enrol("home", [liberoPlayer(12, "LIB L"), liberoPlayer(13, "LIB2 L")])
        table.enrol("away", [liberoPlayer(12, "LIB V")])
        table.toss("home", "home")
        table.lineup("home")
        table.lineup("away")
        return table.start()
    }

    /** Jugadas aceptadas hasta ahora, en orden. */
    get plays() {
        return this.#plays
    }

    /** Ajustes con que se reproduce el acta. */
    get settings() {
        return this.#settings
    }

    /**
     * Inscribe la plantilla de serie de un lado con los jugadores extra que se indiquen.
     * @param {"home"|"away"} side lado
     * @param {object[]} [extras] jugadores añadidos
     * @returns {Table}
     */
    enrol(side, extras = []) {
        return this.play(standardRoster(side, extras))
    }

    /**
     * Registra un sorteo.
     * @param {"home"|"away"} server quién saca
     * @param {"home"|"away"} left quién queda a la izquierda
     * @returns {Table}
     */
    toss(server, left) {
        return this.play({ kind: "toss", server, left })
    }

    /**
     * Fija la formación inicial de un lado.
     * @param {"home"|"away"} side lado
     * @param {Array<number|string>} [shirts] seis dorsales de las zonas I a VI
     * @returns {Table}
     */
    lineup(side, shirts = STARTERS) {
        return this.play({ kind: "lineup", side, shirts: [...shirts] })
    }

    /**
     * Fija las dos formaciones de serie, la del local primero.
     * @returns {Table}
     */
    lineups() {
        return this.lineup("home").lineup("away")
    }

    /**
     * Empieza el periodo que espera.
     * @returns {Table}
     */
    start() {
        return this.play({ kind: "startPeriod" })
    }

    /**
     * Añade una jugada que el motor tiene que aceptar; si la rechaza, la prueba falla con el
     * motivo. La hora la pone el reloj simulado salvo que la jugada traiga la suya.
     * @param {object} play jugada
     * @returns {Table}
     */
    play(play) {
        const verdict = this.verdict(play)
        assert.equal(verdict, null, "jugada rechazada: " + JSON.stringify(play) + " → " + verdict)
        this.#plays.push({ at: this.#tick(), ...play })
        return this
    }

    /**
     * Pide al motor que valide una jugada que tiene que rechazar y devuelve el motivo.
     * @param {object} play jugada
     * @returns {string}
     */
    refuse(play) {
        const verdict = this.verdict(play)
        assert.equal(typeof verdict, "string", "se esperaba un rechazo: " + JSON.stringify(play))
        return verdict
    }

    /**
     * Resultado crudo de check: null si es legal o el motivo si no.
     * @param {object} play jugada
     * @returns {string|null}
     */
    verdict(play) {
        return this.#rules.check(this.#settings, this.#info, this.#plays, play)
    }

    /**
     * Da varios puntos seguidos al mismo lado.
     * @param {"home"|"away"} side lado
     * @param {number} count cuántos
     * @returns {Table}
     */
    burst(side, count) {
        for (let done = 0; done < count; done += 1) {
            this.play({ kind: "rally", side })
        }
        return this
    }

    /**
     * Partido reconstruido con todas las jugadas, o solo con las primeras si se indica cuántas.
     * @param {number} [count] número de jugadas que se reproducen
     * @returns {object} Match
     */
    state(count = this.#plays.length) {
        return this.#rules.replay(this.#settings, this.#info, this.#plays.slice(0, count))
    }

    /**
     * Periodo actual del partido reconstruido.
     * @returns {object} Period
     */
    period() {
        return this.#rules.currentPeriod(this.state())
    }

    /**
     * Avanza el reloj simulado y devuelve la hora nueva en ISO.
     * @returns {string}
     */
    #tick() {
        this.#clock += CLOCK_STEP_SECONDS * 1000
        return new Date(this.#clock).toISOString()
    }
}
