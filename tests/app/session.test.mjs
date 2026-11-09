/**
 * Sesión: abrir y cerrar actas, añadir jugadas, deshacer, aprobar y reabrir.
 * @module tests/app/session.test.mjs
 */

import { beforeEach, describe, it } from "node:test"
import assert from "node:assert/strict"
import {
    fakeRules,
    loadSource,
    MemoryStorage,
    recordingBus,
    recordingNotifier,
} from "./fakes.mjs"

const { Session } = await loadSource("app/session.js")
const { RecordStore } = await loadSource("app/store.js")
const { Bus } = await loadSource("app/bus.js")
const { SEALED_TEXT } = await loadSource("app/constants.js")

const DEMO = {
    home: {
        name: "Equipo Norte",
        players: [[1, "Quim Vidal"], [7, "Martí Pujol", "cl"]],
        staff: [["coach", "Jaume Rius"]],
    },
    away: {
        name: "Equipo Sur",
        players: [{ shirt: 2, name: "Hugo Nadal", libero: true }],
        staff: [{ role: "coach", name: "Laia Casals" }],
    },
}

let storage
let store
let bus
let notifier
let session

/**
 * Temas emitidos, en orden.
 * @returns {string[]}
 */
function topics() {
    return bus.log.map(([topic]) => topic)
}

/**
 * Abre un acta en juego con un set empezado.
 */
function startMatch() {
    session.create({ homeName: "Norte", awayName: "Sur" })
    assert.equal(session.commitBatch([
        { kind: "toss", server: "home", left: "home" },
        { kind: "lineup", side: "home", shirts: [] },
        { kind: "startPeriod" },
    ]), null)
    bus.log.length = 0
    notifier.shown.length = 0
}

beforeEach(() => {
    storage = new MemoryStorage()
    store = new RecordStore(storage)
    bus = recordingBus(Bus)
    notifier = recordingNotifier()
    session = new Session({ store, bus, rules: fakeRules, notifier, demo: DEMO })
    globalThis.empatTapGuardMs = 0
    globalThis.confirm = () => true
})

describe("abrir y cerrar actas", () => {
    it("crear guarda el acta en datos y la anuncia", () => {
        session.create({ competition: "Liga Infantil" })
        assert.equal(session.record.stage, "details")
        assert.equal(session.record.settings.liberoAllowed, false)
        assert.equal(store.load(session.record.id).id, session.record.id)
        assert.deepEqual(topics(), ["record:opened"])
    })

    it("el partido de prueba va directo al sorteo con las dos plantillas", () => {
        session.createDemo()
        const { record } = session
        assert.equal(record.stage, "toss")
        assert.equal(record.demo, true)
        assert.equal(record.info.homeName, "Equipo Norte")
        assert.equal(record.info.competition, "Partido de ejemplo")
        assert.match(record.info.date, /^\d{4}-\d\d-\d\d$/)
        assert.deepEqual(record.plays[0].players[1], {
            shirt: "7",
            name: "Martí Pujol",
            captain: true,
            libero: true,
        })
        assert.deepEqual(record.plays[0].staff, [{ role: "coach", name: "Jaume Rius" }])
        assert.equal(record.plays[1].players[0].shirt, "2")
        assert.equal(record.plays[0].at, undefined)
        assert.equal(notifier.shown.at(-1).good, true)
    })

    it("abrir un acta que no existe la cierra y avisa sin repintar", () => {
        session.create({})
        bus.log.length = 0
        assert.equal(session.open("nada"), false)
        assert.equal(session.record, null)
        assert.equal(session.match, null)
        assert.deepEqual(topics(), [])
        assert.equal(notifier.shown.at(-1).text, "No se ha encontrado el acta.")
    })

    it("abrir reinicia borradores y vista de impresión, pero no el formato", () => {
        session.create({})
        const id = session.record.id
        session.drafts.home = { players: [] }
        session.paperMode = true
        session.paperStyle = "digest"
        assert.equal(session.open(id), true)
        assert.deepEqual(session.drafts, { home: null, away: null })
        assert.equal(session.paperMode, false)
        assert.equal(session.paperStyle, "digest")
    })

    it("salir deja la sesión vacía y lo anuncia", () => {
        session.create({})
        session.leave()
        assert.equal(session.record, null)
        assert.equal(topics().at(-1), "record:left")
    })

    it("el partido se reconstruye solo cuando hace falta", () => {
        session.create({})
        const before = fakeRules.replays
        session.match
        session.match
        assert.equal(fakeRules.replays, before + 1)
        session.invalidate()
        session.match
        assert.equal(fakeRules.replays, before + 2)
    })
})

describe("añadir jugadas", () => {
    it("una jugada válida se guarda con hora y se anuncia tras el repintado", () => {
        startMatch()
        assert.equal(session.commit({ kind: "rally", side: "home" }), null)
        const last = session.record.plays.at(-1)
        assert.equal(typeof last.at, "string")
        assert.deepEqual(topics(), ["render", "play:committed"])
        const payload = bus.log[1][1]
        assert.equal(payload.play, last)
        assert.equal(payload.autoBefore, 0)
        assert.deepEqual(payload.captainBefore, { home: false, away: false })
        assert.equal(session.match.periods[0].score.home, 1)
        assert.equal(JSON.parse(storage.getItem("empat/acta/" + session.record.id)).plays.length, 4)
    })

    it("respeta la hora si ya viene", () => {
        startMatch()
        session.commit({ kind: "note", text: "x", at: "2000" })
        assert.equal(session.record.plays.at(-1).at, "2000")
    })

    it("un rechazo avisa, se anuncia y no guarda", () => {
        startMatch()
        assert.equal(session.commit({ kind: "bad" }), "Jugada no válida.")
        assert.equal(notifier.shown.at(-1).text, "Jugada no válida.")
        assert.deepEqual(topics(), ["play:refused"])
        assert.equal(session.record.plays.length, 3)
    })

    it("en silencio no avisa del rechazo", () => {
        startMatch()
        session.commit({ kind: "bad" }, { quiet: true })
        assert.equal(notifier.shown.length, 0)
    })

    it("un segundo punto demasiado seguido es un doble toque", () => {
        startMatch()
        globalThis.empatTapGuardMs = 60000
        session.lastRallyAt = 0
        assert.equal(session.commit({ kind: "rally", side: "home" }), null)
        assert.equal(session.commit({ kind: "rally", side: "away" }), "double-tap")
        assert.equal(notifier.shown.at(-1).text, "Pulsación doble: solo se ha sumado un punto.")
        assert.equal(session.record.plays.length, 4)
        assert.equal(session.commit({ kind: "note", text: "sí" }), null)
    })

    it("con el acta cerrada solo se aceptan firmas", () => {
        startMatch()
        session.seal()
        assert.equal(session.commit({ kind: "note", text: "x" }), SEALED_TEXT)
        assert.equal(notifier.shown.at(-1).text, SEALED_TEXT)
        assert.equal(session.commit({ kind: "note" }, { quiet: true }), SEALED_TEXT)
        assert.equal(session.commit({ kind: "sign", slot: "scorer" }), null)
    })

    it("el lote es todo o nada y comparte la hora", () => {
        session.create({})
        bus.log.length = 0
        const refused = session.commitBatch([{ kind: "toss" }, { kind: "bad" }])
        assert.equal(refused, "Jugada no válida.")
        assert.equal(session.record.plays.length, 0)
        assert.deepEqual(topics(), [])
        const plays = [{ kind: "toss" }, { kind: "startPeriod" }, { kind: "rally", side: "home" }]
        assert.equal(session.commitBatch(plays), null)
        const stamps = new Set(session.record.plays.map((play) => play.at))
        assert.equal(stamps.size, 1)
        assert.deepEqual(topics(), ["render"])
    })
})

describe("deshacer", () => {
    it("no deshace nada en preparación", () => {
        session.create({})
        session.commit({ kind: "roster", side: "home" })
        assert.equal(session.undo(), "No queda nada por deshacer.")
        assert.equal(session.record.plays.length, 1)
    })

    it("deshace el último punto y lo anota con el marcador previo", () => {
        startMatch()
        session.commit({ kind: "rally", side: "away" })
        const point = session.record.plays.at(-1)
        session.commit({ kind: "sign", slot: "scorer" })
        let question = ""
        globalThis.confirm = (text) => {
            question = text
            return true
        }
        assert.equal(session.undo(), null)
        assert.equal(question, "¿Quieres deshacer \"Punto para Sur\"?")
        assert.deepEqual(session.record.plays.map((play) => play.kind).slice(-2),
            ["startPeriod", "sign"])
        const note = session.record.amendments[0]
        assert.deepEqual(Object.keys(note), ["at", "text", "playAt", "period", "home", "away"])
        assert.equal(note.text, "Punto para Sur")
        assert.equal(note.playAt, point.at)
        assert.equal(note.away, 1)
        assert.deepEqual(notifier.shown.at(-1), { text: "Se ha deshecho: Punto para Sur", good: true })
    })

    it("deshacer el inicio de set se lleva sorteo y formaciones", () => {
        startMatch()
        session.undo()
        assert.deepEqual(session.record.plays, [])
    })

    it("si no se confirma no cambia nada", () => {
        startMatch()
        globalThis.confirm = () => false
        assert.equal(session.undo(), null)
        assert.equal(session.record.plays.length, 3)
        assert.equal(session.record.amendments, undefined)
    })

    it("con el acta cerrada no se deshace", () => {
        startMatch()
        session.seal()
        assert.equal(session.undo(), SEALED_TEXT)
        assert.equal(session.record.plays.length, 3)
    })
})

describe("aprobar y reabrir", () => {
    it("aprobar sella el acta, la guarda y repinta", () => {
        startMatch()
        session.seal()
        assert.equal(typeof session.record.sealed.at, "string")
        assert.equal(JSON.parse(storage.getItem("empat/acta/" + session.record.id)).sealed.at,
            session.record.sealed.at)
        assert.deepEqual(topics(), ["render"])
        assert.deepEqual(notifier.shown.at(-1), { text: "El acta ha quedado aprobada y cerrada.", good: true })
    })

    it("reabrir exige la clave y deja la corrección", () => {
        startMatch()
        session.commit({ kind: "rally", side: "home" })
        session.seal()
        assert.equal(session.reopen("1234"), "Contraseña del 1er árbitro incorrecta.")
        assert.ok(session.record.sealed)
        assert.equal(session.reopen("0000"), null)
        assert.equal(session.record.sealed, undefined)
        const note = session.record.amendments.at(-1)
        assert.deepEqual(Object.keys(note), ["at", "text", "period", "home", "away"])
        assert.match(note.text, /^Acta reabierta; llevaba aprobada desde las \d\d:\d\d$/)
        assert.equal(note.home, 1)
        assert.deepEqual(notifier.shown.at(-1), { text: "El acta se ha reabierto.", good: true })
    })
})
