/**
 * Sesión y avisos con el motor de verdad: un partido de prueba desde el sorteo hasta deshacer.
 * @module tests/app/engine.test.mjs
 */

import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { loadSource, MemoryStorage, recordingBus, recordingNotifier } from "./fakes.mjs"

const rules = await loadSource("rules/index.js")
const { Session } = await loadSource("app/session.js")
const { RecordStore } = await loadSource("app/store.js")
const { Bus } = await loadSource("app/bus.js")
const { installNotices } = await loadSource("app/notices.js")

/**
 * Plantilla de ocho jugadores con el 1 de capitán.
 * @param {string} name nombre del equipo
 * @returns {object}
 */
function squad(name) {
    const players = []
    for (let shirt = 1; shirt <= 8; shirt += 1) {
        players.push(shirt === 1 ? [shirt, "Jugador " + shirt, "c"] : [shirt, "Jugador " + shirt])
    }
    return { name, players, staff: [["coach", "Entrenador " + name]] }
}

/**
 * Sesión con el motor real, avisos instalados y un partido de prueba abierto.
 * @returns {{session: Session, notifier: object, bus: Bus}}
 */
function demoSession() {
    const bus = recordingBus(Bus)
    const notifier = recordingNotifier()
    const store = new RecordStore(new MemoryStorage())
    const demo = { home: squad("Norte"), away: squad("Sur") }
    const session = new Session({ store, bus, rules, notifier, demo })
    installNotices({ bus, session, notifier })
    globalThis.empatTapGuardMs = 0
    globalThis.confirm = () => true
    session.createDemo()
    return { session, notifier, bus }
}

/**
 * Indica si el motor ya está implementado.
 * @returns {boolean}
 */
function engineReady() {
    try {
        rules.replay(rules.DEFAULT_SETTINGS, {}, [])
        return true
    } catch {
        return false
    }
}

describe("sesión con el motor real", { skip: !engineReady() }, () => {
    it("el sorteo, las formaciones y el inicio entran juntos y se deshacen juntos", () => {
        const { session } = demoSession()
        const refused = session.commitBatch([
            { kind: "toss", server: "home", left: "away" },
            { kind: "lineup", side: "home", shirts: ["1", "2", "3", "4", "5", "6"] },
            { kind: "lineup", side: "away", shirts: ["1", "2", "3", "4", "5", "6"] },
            { kind: "startPeriod" },
        ])
        assert.equal(refused, null)
        assert.equal(session.match.phase, "live")
        assert.equal(session.commit({ kind: "rally", side: "away" }), null)
        assert.equal(rules.currentPeriod(session.match).score.away, 1)
        assert.equal(session.undo(), null)
        assert.equal(session.record.amendments[0].text, "Punto para Sur")
        assert.equal(session.record.amendments[0].away, 1)
        assert.equal(session.undo(), null)
        assert.equal(session.match.phase, "setup")
        assert.deepEqual(session.record.plays.map((play) => play.kind), ["roster", "roster"])
    })

    it("un lote con una jugada ilegal no guarda nada", () => {
        const { session } = demoSession()
        const refused = session.commitBatch([
            { kind: "toss", server: "home", left: "away" },
            { kind: "startPeriod" },
        ])
        assert.equal(typeof refused, "string")
        assert.equal(session.record.plays.length, 2)
    })

    it("avisa del último tiempo de descanso del set", () => {
        const { session, notifier } = demoSession()
        session.commitBatch([
            { kind: "toss", server: "home", left: "away" },
            { kind: "lineup", side: "home", shirts: ["1", "2", "3", "4", "5", "6"] },
            { kind: "lineup", side: "away", shirts: ["1", "2", "3", "4", "5", "6"] },
            { kind: "startPeriod" },
        ])
        session.commit({ kind: "timeout", side: "home" })
        session.commit({ kind: "rally", side: "home" })
        session.commit({ kind: "timeout", side: "home" })
        assert.equal(notifier.shown.at(-1).text, "Último tiempo de descanso del set para Norte (n.º 2).")
    })

    it("avisa cuando el capitán sale de pista", () => {
        const { session, notifier } = demoSession()
        session.commitBatch([
            { kind: "toss", server: "home", left: "away" },
            { kind: "lineup", side: "home", shirts: ["1", "2", "3", "4", "5", "6"] },
            { kind: "lineup", side: "away", shirts: ["1", "2", "3", "4", "5", "6"] },
            { kind: "startPeriod" },
        ])
        const refused = session.commit({
            kind: "substitution",
            side: "home",
            leaving: "1",
            entering: "7",
        })
        assert.equal(refused, null)
        const expected = "Norte: el capitán (1) está fuera de la pista; designa al capitán en "
            + "juego."
        assert.equal(notifier.shown.at(-1).text, expected)
    })
})
