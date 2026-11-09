/**
 * Tantos, saque, rotación y turnos de saque: lo que cambia con cada rally ganado.
 * @module tests/rules/scoring.test.mjs
 */
import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { loadRules } from "../support/load.mjs"
import { rally, substitution } from "../support/plays.mjs"
import { Table, asShirts } from "../support/table.mjs"

const rules = await loadRules()

describe("tanto, saque y rotación", function () {
    it("al empezar saca quien ganó el sorteo con la formación tal cual", function () {
        const period = Table.ready(rules).period()
        assert.equal(period.serving, "home")
        assert.deepEqual(period.rotation.home, asShirts([1, 2, 3, 4, 5, 6]))
    })

    it("quien saca y gana sigue sacando sin rotar", function () {
        const period = Table.ready(rules).play(rally("home")).period()
        assert.equal(period.serving, "home")
        assert.deepEqual(period.rotation.home, asShirts([1, 2, 3, 4, 5, 6]))
        assert.deepEqual(period.score, { home: 1, away: 0 })
    })

    it("quien recibe y gana rota y saca su jugador de la zona II", function () {
        const table = Table.ready(rules).play(rally("home"))
        const period = table.play(rally("away")).period()
        assert.equal(period.serving, "away")
        assert.deepEqual(period.rotation.away, asShirts([2, 3, 4, 5, 6, 1]))
        assert.equal(period.rotation.away[0], "2")
        assert.equal(period.turns.home[0].until, 1, "el turno del 1 local acaba con 1 tanto")
        assert.equal(period.turns.away[0].server, "2")
        assert.equal(period.turns.away[0].column, 1, "saca el de la columna II")
    })

    it("al recuperar el saque el local también rota", function () {
        const table = Table.ready(rules).burst("home", 1).burst("away", 1).burst("home", 1)
        const period = table.period()
        assert.deepEqual(period.rotation.home, asShirts([2, 3, 4, 5, 6, 1]))
        assert.equal(period.turns.home[1].server, "2")
    })

    it("el registro guarda el marcador absoluto y la causa de serie", function () {
        const period = Table.ready(rules).burst("away", 1).period()
        const entry = period.rallyLog[0]
        assert.equal(entry.side, "away")
        assert.equal(entry.home, 0)
        assert.equal(entry.away, 1)
        assert.equal(entry.cause, "play")
        assert.equal(period.rallyCount, 1)
    })
})

describe("turnos de saque", function () {
    it("tras una vuelta completa la columna vuelve a la primera", function () {
        const table = Table.ready(rules)
        for (let cycle = 0; cycle < 7; cycle += 1) {
            table.burst("away", 1).burst("home", 1)
        }
        const turns = table.period().turns.home
        assert.deepEqual(turns.map((turn) => turn.column), [0, 1, 2, 3, 4, 5, 0, 1])
        assert.deepEqual(turns.map((turn) => turn.server), asShirts([1, 2, 3, 4, 5, 6, 1, 2]))
    })

    it("since son los tantos propios al recuperar el saque y until al perderlo", function () {
        const table = Table.ready(rules)
        for (let cycle = 0; cycle < 3; cycle += 1) {
            table.burst("away", 1).burst("home", 1)
        }
        const turns = table.period().turns.home
        assert.deepEqual(turns.map((turn) => turn.since), [0, 1, 2, 3])
        assert.deepEqual(turns.map((turn) => turn.until), [0, 1, 2, null])
    })

    it("un suplente saca en la columna del titular por el que entró", function () {
        const table = Table.ready(rules).burst("away", 1)
        table.play(substitution("home", 2, 7))
        const turn = table.burst("home", 1).period().turns.home.at(-1)
        assert.equal(turn.server, "7")
        assert.equal(turn.column, 1)
    })

    it("tras una excepcional el que saca no tiene columna", function () {
        const table = Table.ready(rules).burst("away", 1)
        table.play(substitution("home", 2, 8, true))
        const turn = table.burst("home", 1).period().turns.home.at(-1)
        assert.equal(turn.server, "8")
        assert.equal(turn.column, -1)
    })

    it("al cerrar el set se cierran los turnos de los dos lados", function () {
        const table = Table.ready(rules).burst("away", 1).burst("home", 25)
        const period = table.state().periods[0]
        assert.equal(period.turns.home.at(-1).until, 25)
        assert.equal(period.turns.away.at(-1).until, 1)
    })
})
