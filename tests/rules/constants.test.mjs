/**
 * Valores fijos que exporta el motor y que la interfaz y el acta impresa dan por supuestos.
 * @module tests/rules/constants.test.mjs
 */
import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { loadRules } from "../support/load.mjs"

const rules = await loadRules()

describe("constantes del motor", function () {
    it("ajustes de serie", function () {
        assert.deepEqual({ ...rules.DEFAULT_SETTINGS }, {
            bestOf: 5,
            setPoints: 25,
            deciderPoints: 15,
            timeouts: 2,
            substitutions: 6,
            deciderSwitch: 8,
            liberoAllowed: true,
            fullSetRule: false,
        })
    })

    it("categorías en el orden del acta", function () {
        assert.deepEqual(Object.keys(rules.CATEGORY_NAMES), ["Y", "J", "C", "I", "A"])
        assert.deepEqual({ ...rules.CATEGORY_NAMES }, {
            Y: "Júnior",
            J: "Juvenil",
            C: "Cadete",
            I: "Infantil",
            A: "Alevín",
        })
    })

    it("cargos del cuerpo técnico en el orden de los desplegables", function () {
        const order = "coach assistant assistant2 physio doctor psychologist fitness masseur"
        assert.deepEqual(Object.keys(rules.STAFF_TITLES), order.split(" "))
        assert.deepEqual({ ...rules.STAFF_TITLES }, {
            coach: "Entrenador",
            assistant: "Entrenador asistente",
            assistant2: "2º entrenador asistente",
            physio: "Fisioterapeuta",
            doctor: "Médico",
            psychologist: "Psicólogo",
            fitness: "Preparador físico",
            masseur: "Masajista",
        })
    })

    it("lados y fases", function () {
        assert.deepEqual([...rules.SIDES], ["home", "away"])
        assert.deepEqual({ ...rules.PHASE },
            { setup: "setup", live: "live", break: "break", over: "over" })
    })

    it("rival: el contrario de home es away y de cualquier otra cosa, home", function () {
        assert.equal(rules.rival("home"), "away")
        assert.equal(rules.rival("away"), "home")
        assert.equal(rules.rival("x"), "home")
        assert.equal(rules.rival(undefined), "home")
    })

    it("isSide solo acepta los dos lados", function () {
        assert.equal(rules.isSide("home"), true)
        assert.equal(rules.isSide("away"), true)
        assert.equal(rules.isSide("L"), false)
    })

    it("minutos entre dos horas, redondeados, o null si falta una", function () {
        assert.equal(rules.minutesBetween("2030-01-01T17:00:00Z", "2030-01-01T17:29:40Z"), 30)
        assert.equal(rules.minutesBetween(null, "2030-01-01T17:29:40Z"), null)
        assert.equal(rules.minutesBetween("2030-01-01T17:00:00Z", ""), null)
    })

    it("un partido nuevo empieza en preparación con un periodo vacío", function () {
        const match = new rules.Match()
        assert.equal(match.phase, "setup")
        assert.equal(match.periods.length, 1)
        assert.equal(rules.currentPeriod(match).number, 1)
        assert.equal(match.setsToWin, 3)
        assert.equal(match.settings.bestOf, 5)
    })

    it("un tipo de jugada desconocido se rechaza con su nombre", function () {
        assert.equal(rules.check({}, {}, [], { kind: "dance" }), "Tipo de jugada no reconocido: dance")
    })

    it("check no deja rastro en las jugadas recibidas", function () {
        const plays = [{ kind: "roster", side: "home", players: [{ shirt: "07" }] }]
        const before = JSON.stringify(plays)
        rules.check({}, {}, plays, { kind: "roster", side: "away", players: [{ shirt: 1 }] })
        assert.equal(JSON.stringify(plays), before)
    })

    it("walk visita cada jugada y corta cuando el observador lo pide", function () {
        const plays = [
            { kind: "roster", side: "home", players: [{ shirt: 1 }] },
            { kind: "roster", side: "away", players: [{ shirt: 2 }] },
            { kind: "note", text: "hola" },
        ]
        const seen = []
        rules.walk({}, {}, plays, function visit(match, index) {
            seen.push(index)
        })
        assert.deepEqual(seen, [0, 1, 2])
        const cut = []
        rules.walk({}, {}, plays, (match, index) => cut.push(index) === 2)
        assert.deepEqual(cut, [0, 1])
    })
})
