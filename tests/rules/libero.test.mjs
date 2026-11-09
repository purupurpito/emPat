/**
 * Líbero: entradas y salidas, salida automática al pasar a la delantera, partidos sin líbero,
 * líbero impedido y redesignación (FIVB 19).
 * @module tests/rules/libero.test.mjs
 */
import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { loadRules } from "../support/load.mjs"
import {
    liberoIn,
    liberoOut,
    liberoUnfit,
    rally,
    sanction,
    substitution,
} from "../support/plays.mjs"
import { Table, asShirts, liberoPlayer } from "../support/table.mjs"

const rules = await loadRules()

describe("entrada y salida del líbero", function () {
    it("solo por un zaguero, nunca por el que va a sacar y si está inscrito", function () {
        const table = Table.ready(rules)
        assert.match(table.refuse(liberoIn("home", 12, 3)), /zaguero/)
        assert.match(table.refuse(liberoIn("home", 12, 1)), /no saca/)
        assert.match(table.refuse(liberoIn("home", 7, 5)),
            /no figura como líbero/)
    })

    it("ocupa la zona de su jugador y pide un rally antes de otro cambio", function () {
        const table = Table.ready(rules).play(liberoIn("away", 12, 5))
        assert.deepEqual(rules.onCourt(table.period(), "away"), asShirts([1, 2, 3, 4, 12, 6]))
        assert.deepEqual(table.period().rotation.away, asShirts([1, 2, 3, 4, 5, 6]),
            "la rotación guarda al jugador sustituido")
        assert.match(table.refuse(liberoOut("away")), /completarse una jugada/)
        assert.match(table.refuse(substitution("away", 5, 7)),
            /antes debe salir el líbero/)
    })

    it("sale solo al rotar a la zona IV", function () {
        const table = Table.ready(rules).play(liberoIn("away", 12, 5))
        table.burst("away", 1)
        const match = table.state()
        const period = rules.currentPeriod(match)
        assert.equal(period.libero.away, null, "el líbero sale al pasar a la delantera")
        assert.deepEqual(rules.onCourt(period, "away"), asShirts([2, 3, 4, 5, 6, 1]))
        const exits = match.automatic.filter((entry) => entry.kind === "liberoAutoOut")
        assert.equal(exits.length, 1)
        assert.equal(exits[0].side, "away")
        assert.equal(exits[0].period, 1)
        assert.equal(exits[0].libero, "12")
        assert.equal(exits[0].back, "5")
        assert.equal(typeof exits[0].at, "string")
    })

    it("la salida automática va con el marcador nuevo, sin hora y como reemplazo", function () {
        const table = Table.ready(rules).play(liberoIn("away", 12, 5))
        const period = table.burst("away", 1).period()
        const swap = period.liberoSwaps.away.at(-1)
        assert.equal(swap.entering, "5")
        assert.equal(swap.leaving, "12")
        assert.equal(swap.own, 1)
        assert.equal(swap.rival, 0)
        assert.equal(swap.auto, true)
        assert.equal("at" in swap, false)
        assert.equal(period.lastLiberoRally.away, period.rallyCount)
    })

    it("cambio de líbero por líbero tras un rally y salida normal", function () {
        const table = Table.ready(rules).play(liberoIn("away", 12, 5))
        table.burst("away", 1).play(liberoIn("home", 12, 6))
        assert.match(table.refuse(liberoIn("home", 13, 12)), /completarse una jugada/)
        table.burst("away", 1).play(liberoIn("home", 13, 12))
        const libero = table.period().libero.home
        assert.equal(libero.shirt, "13")
        assert.equal(libero.replacing, "6")
        table.burst("away", 1).play(liberoOut("home"))
        assert.deepEqual(rules.onCourt(table.period(), "home"), asShirts([1, 2, 3, 4, 5, 6]))
    })

    it("un castigo también es una jugada completada (FIVB 6.1.3)", function () {
        const table = Table.ready(rules).burst("home", 1).burst("away", 1)
        const back = table.period().rotation.home[5]
        table.play(liberoIn("home", 12, back))
        assert.match(table.refuse(liberoOut("home")), /completarse una jugada/)
        table.play(sanction("away", 2, "penalty"))
        assert.equal(table.verdict(liberoOut("home")), null)
    })
})

describe("partido sin líbero", function () {
    it("no se puede inscribir ninguno", function () {
        const roster = {
            kind: "roster",
            side: "home",
            players: [{ shirt: 1 }, liberoPlayer(12, "L")],
        }
        assert.match(rules.check({ liberoAllowed: false }, {}, [], roster), /no tiene líbero/)
    })

    it("con el ajuste activo el mismo cambio es legal", function () {
        const table = Table.ready(rules)
        const play = liberoIn("away", 12, 5)
        assert.equal(rules.check({ liberoAllowed: true }, {}, table.plays, play), null)
    })
})

describe("líbero que no puede seguir", function () {
    it("si estaba en pista le sustituye el otro líbero y él queda fuera del partido", function () {
        const table = Table.ready(rules).play(liberoIn("home", 12, 6))
        table.burst("away", 1).play(liberoUnfit("home", 12))
        const match = table.state()
        assert.equal(rules.currentPeriod(match).libero.home.shirt, "13")
        assert.ok(match.outForMatch.home.has("12"))
        assert.equal(table.refuse(liberoIn("home", 12, 5)),
            "El líbero 12 no está autorizado a jugar.")
    })

    it("con un solo líbero se redesigna a alguien del banquillo", function () {
        const table = Table.ready(rules).play(liberoIn("home", 12, 6))
        table.burst("away", 1).play(liberoUnfit("home", 12))
        assert.equal(table.refuse(liberoUnfit("away", 12, 3)),
            "El 3 está en pista: para re-designarlo como líbero tiene que estar fuera.")
        assert.equal(table.refuse(liberoUnfit("away", 12, 1)),
            "El 1 está en pista: para re-designarlo como líbero tiene que estar fuera.")
        table.play(liberoUnfit("away", 12, 7))
        const seven = table.state().teams.away.players.find((player) => player.shirt === "7")
        assert.equal(seven.libero, true, "el 7 pasa a ser líbero")
        assert.equal(seven.redesignated, true)
        assert.match(table.refuse(substitution("away", 3, 7)), /líbero/,
            "ya no puede entrar por sustitución")
        table.burst("home", 1).play(liberoIn("away", 7, 6))
        assert.equal(table.period().libero.away.shirt, "7")
        assert.equal(table.state().liberoLosses.away[0].successor, "7")
    })

    it("la redesignación no modifica la jugada de plantilla guardada", function () {
        const table = Table.ready(rules).play(liberoUnfit("away", 12, 7))
        table.state()
        const roster = table.plays.find((play) => play.kind === "roster" && play.side === "away")
        const seven = roster.players.find((player) => player.shirt === 7)
        assert.equal(seven.libero, undefined)
    })

    it("con dos líberos no se redesigna mientras el otro pueda jugar (FIVB 19.4.3.1)", function () {
        const table = Table.ready(rules)
        assert.match(table.refuse(liberoUnfit("home", 12, 8)),
            /Aún queda el otro líbero, el 13/)
        table.play(liberoUnfit("home", 12))
        table.play(liberoUnfit("home", 13, 8))
        const eight = table.state().teams.home.players.find((player) => player.shirt === "8")
        assert.ok(eight.libero, "sin ninguno disponible, sí")
    })
})

describe("líbero en pista y sustituciones", function () {
    it("la excepcional no vale para el que está fuera por el líbero", function () {
        const table = Table.ready(rules).play(liberoIn("away", 12, 5))
        const play = substitution("away", 5, 7, true)
        assert.match(table.refuse(play), /reemplazado por el líbero/)
    })

    it("el sancionado que está fuera por el líbero sí se sustituye y el líbero sigue", function () {
        const table = Table.ready(rules).play(liberoIn("away", 12, 5))
        table.play(sanction("away", 5, "expulsion"))
        assert.match(table.refuse(rally("home")), /sustituye/)
        table.play(substitution("away", 5, 7))
        const period = table.period()
        assert.equal(period.libero.away.replacing, "7")
        assert.equal(period.rotation.away[4], "7")
        assert.deepEqual(rules.onCourt(period, "away"), asShirts([1, 2, 3, 4, 12, 6]))
        table.play(rally("home"))
    })
})
