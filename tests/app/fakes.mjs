/**
 * Dobles de prueba para el núcleo de la interfaz: almacenamiento en memoria, motor mínimo,
 * bus que anota y avisos que anotan. El motor falso solo sabe lo justo para que la sesión
 * tenga fases, marcador y rechazos; las reglas de verdad se prueban en tests/rules.
 * @module tests/app/fakes.mjs
 */

import { pathToFileURL, fileURLToPath } from "node:url"
import { join } from "node:path"

const WEB = fileURLToPath(new URL("../../web/", import.meta.url))

/**
 * Importa un módulo de web/src por su ruta relativa.
 * @param {string} path ruta bajo web/src
 * @returns {Promise<object>}
 */
export function loadSource(path) {
    return import(pathToFileURL(join(WEB, "src", path)).href)
}

/**
 * Almacenamiento con la interfaz de Storage. Con broken = true todas las operaciones fallan,
 * como un navegador sin espacio o con el almacenamiento bloqueado.
 */
export class MemoryStorage {
    #items = new Map()
    broken = false

    get length() {
        this.#guard()
        return this.#items.size
    }

    key(index) {
        this.#guard()
        return [...this.#items.keys()][index] ?? null
    }

    getItem(key) {
        this.#guard()
        return this.#items.has(key) ? this.#items.get(key) : null
    }

    setItem(key, value) {
        this.#guard()
        this.#items.set(key, String(value))
    }

    removeItem(key) {
        this.#guard()
        this.#items.delete(key)
    }

    #guard() {
        if (this.broken) {
            throw new Error("almacenamiento no disponible")
        }
    }
}

/**
 * Marcador de un lado contando los puntos de las jugadas.
 * @param {object[]} plays jugadas
 * @param {string} side lado
 * @returns {number}
 */
function pointsOf(plays, side) {
    return plays.filter((play) => play.kind === "rally" && play.side === side).length
}

/**
 * Motor falso. Un set empieza con startPeriod; los puntos solo valen con el set empezado; la
 * jugada "bad" siempre se rechaza; info.broken hace que replay reviente.
 */
export const fakeRules = {
    replays: 0,
    replay(settings, info, plays) {
        fakeRules.replays += 1
        if (info.broken) {
            throw new Error("acta irrecuperable")
        }
        const starts = plays.filter((play) => play.kind === "startPeriod").length
        return {
            settings,
            info,
            phase: starts > 0 ? "live" : "setup",
            automatic: plays.filter((play) => play.kind === "autoOut").map(() => ({
                kind: "liberoAutoOut",
            })),
            periods: [{
                number: Math.max(1, starts),
                score: { home: pointsOf(plays, "home"), away: pointsOf(plays, "away") },
            }],
        }
    },
    check(settings, info, plays, play) {
        if (play.kind === "bad") {
            return "Jugada no válida."
        }
        const started = plays.some((done) => done.kind === "startPeriod")
        if (play.kind === "rally" && !started) {
            return "El set no ha empezado."
        }
        return null
    },
    currentPeriod(match) {
        return match.periods.at(-1)
    },
    needsActingCaptain() {
        return false
    },
}

/**
 * Bus que además de repartir apunta cada emisión.
 * @param {Function} Bus clase real
 * @returns {object}
 */
export function recordingBus(Bus) {
    const bus = new Bus()
    bus.log = []
    const emit = bus.emit.bind(bus)
    bus.emit = (topic, payload) => {
        bus.log.push([topic, payload])
        emit(topic, payload)
    }
    return bus
}

/**
 * Avisos que solo se apuntan.
 * @returns {{shown: Array, show: Function, many: Function}}
 */
export function recordingNotifier() {
    const shown = []
    return {
        shown,
        show(text, options = {}) {
            shown.push({ text, good: Boolean(options.good) })
        },
        many(lines) {
            shown.push({ text: lines.join("\n"), good: false })
        },
    }
}
