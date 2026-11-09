/**
 * Final de set y de partido, set decisivo, deshacer y castigos que esperan al set siguiente.
 * @module tests/rules/period-end.test.mjs
 */
import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { loadRules } from "../support/load.mjs"
import { rally, sanction, substitution } from "../support/plays.mjs"
import { Table, asShirts } from "../support/table.mjs"

const rules = await loadRules()

/**
 * Juega cuatro sets alternos (local, visitante, local, visitante) y deja el partido 2-2 a las
 * puertas del decisivo, con las alineaciones de cada set intermedio ya puestas.
 * @returns {Table}
 */
function twoAll() {
    const table = Table.ready(rules).burst("home", 25)
    table.lineups().start().burst("away", 25)
    table.lineups().start().burst("home", 25)
    table.lineups().start().burst("away", 25)
    return table
}

describe("final de set", function () {
    it("24-24 sigue y 25-24 también: hacen falta dos de ventaja", function () {
        const table = Table.ready(rules).burst("home", 24).burst("away", 24)
        assert.equal(table.period().number, 1)
        assert.equal(table.burst("home", 1).period().number, 1)
    })

    it("26-24 cierra el set y prepara el siguiente con campo y saque cambiados", function () {
        const table = Table.ready(rules).burst("home", 24).burst("away", 24)
        const match = table.burst("home", 2).state()
        assert.equal(match.periods[0].winner, "home")
        assert.deepEqual(match.periods[0].score, { home: 26, away: 24 })
        assert.equal(match.phase, "break")
        assert.equal(match.periods[1].leftSide, "away", "cambian de campo")
        assert.equal(match.periods[1].firstServer, "away", "saca quien no sacó en el set 1")
        assert.equal(match.periods[1].startedAt, null)
    })

    it("entre sets no hay sorteo ni tantos", function () {
        const table = Table.ready(rules).burst("home", 25)
        assert.equal(table.refuse({ kind: "toss", server: "home", left: "home" }),
            "Ahora el sorteo solo corresponde antes del set decisivo.")
        assert.equal(table.refuse(rally("home")), "No hay ningún set en juego.")
    })
})

describe("partido a cinco sets", function () {
    it("el quinto es el decisivo y pide alineaciones y sorteo", function () {
        const table = twoAll()
        assert.equal(table.state().periods[4].decider, true)
        assert.equal(table.refuse({ kind: "startPeriod" }), "Faltan las formaciones iniciales.")
        table.lineups()
        assert.equal(table.refuse({ kind: "startPeriod" }), "Antes hay que hacer el sorteo.")
    })

    it("en el decisivo se cambia de campo a los 8, una sola vez", function () {
        const table = twoAll().lineups().toss("away", "away").start()
        assert.equal(table.burst("away", 7).period().leftSide, "away")
        const switched = table.burst("away", 1).period()
        assert.equal(switched.leftSide, "home", "cambio de campo al llegar a 8")
        assert.equal(switched.switched, true)
        assert.equal(table.burst("home", 8).period().leftSide,
            "home", "el cambio solo se hace una vez")
        const notes = table.state().automatic.filter((entry) => entry.kind === "courtSwitch")
        assert.equal(notes.length, 1)
        assert.equal(notes[0].period, 5)
    })

    it("el decisivo se gana a 15 y el resumen cuadra", function () {
        const table = twoAll().lineups().toss("away", "away").start()
        table.burst("away", 8).burst("home", 8).burst("away", 7)
        const match = table.state()
        assert.equal(match.phase, "over")
        assert.deepEqual(match.periods[4].score, { home: 8, away: 15 })
        const summary = rules.summarize(match)
        assert.equal(summary.winner, "away")
        assert.equal(summary.totals.away.won, 3)
        assert.equal(summary.totals.home.won, 2)
        assert.equal(summary.rows.length, 5)
        assert.equal(summary.totals.home.points, 25 * 2 + 8)
        assert.ok(summary.matchMinutes > 0)
        assert.equal(table.refuse(rally("home")), "No hay ningún set en juego.")
    })
})

describe("partido al mejor de tres", function () {
    it("el tercero es el decisivo", function () {
        const table = Table.ready(rules, { bestOf: 3 }).burst("home", 25)
        table.lineups().start().burst("away", 25)
        assert.equal(table.state().periods[2].decider, true)
    })

    it("dos sets ganados acaban el partido", function () {
        const table = Table.ready(rules, { bestOf: 3 }).burst("home", 25)
        const match = table.lineups().start().burst("home", 25).state()
        assert.equal(match.phase, "over")
        assert.deepEqual(match.setsWon, { home: 2, away: 0 })
        assert.equal(match.endedAt, match.periods[1].endedAt)
    })
})

describe("deshacer", function () {
    it("reproducir sin la última jugada devuelve el estado anterior", function () {
        const table = Table.ready(rules).burst("away", 3)
        table.play(substitution("home", 3, 7))
        const before = rules.currentPeriod(table.state(table.plays.length - 1))
        assert.deepEqual(before.rotation.home, asShirts([1, 2, 3, 4, 5, 6]))
        assert.deepEqual(before.score, { home: 0, away: 3 })
    })
})

describe("castigo entre sets", function () {
    it("se anota en el set nuevo a 0-0 y el tanto llega al empezarlo", function () {
        const table = Table.ready(rules).burst("home", 25)
        table.play(sanction("away", "coach", "penalty"))
        assert.equal(table.period().score.home, 0, "entre sets todavía no cuenta")
        const entry = table.state().sanctions[0]
        assert.equal(entry.period, 2)
        assert.equal(entry.own, 0)
        assert.equal(entry.rival, 0)
        const period = table.lineups().start().period()
        assert.deepEqual(period.score, { home: 1, away: 0 })
        assert.equal(period.serving, "home", "y el saque")
        assert.equal(period.rallyLog[0].cause, "penalty")
        assert.deepEqual(table.state().pendingPenalties, [])
    })

    it("antes del partido el castigo también espera al primer set", function () {
        const table = new Table(rules).enrol("home").enrol("away")
        table.play(sanction("home", "coach", "penalty"))
        assert.deepEqual(table.state().pendingPenalties, [{ side: "away", level: "penalty" }])
        const period = table.toss("home", "home").lineups().start().period()
        assert.deepEqual(period.score, { home: 0, away: 1 })
        assert.equal(period.serving, "away")
    })
})
