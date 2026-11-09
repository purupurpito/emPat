/**
 * Set obligatorio: qué sets cuentan como jugados completos y cómo mandan las marcas a mano.
 * @module tests/rules/full-set.test.mjs
 */
import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { loadRules } from "../support/load.mjs"
import { fullSetMark, substitution } from "../support/plays.mjs"
import { Table, fullSetRow } from "../support/table.mjs"

const rules = await loadRules()

/**
 * Partido con set obligatorio en el que el 3 local ha sido sustituido por el 7 en el primer set.
 * @returns {Table}
 */
function withChange() {
    return Table.ready(rules, { fullSetRule: true })
        .play(substitution("home", 3, 7))
}

/**
 * Fila de un jugador en el informe actual de la mesa.
 * @param {Table} table mesa
 * @param {"home"|"away"} side lado
 * @param {string} shirt dorsal
 * @returns {object}
 */
function rowOf(table, side, shirt) {
    return fullSetRow(rules.fullSetReport(table.state()), side, shirt)
}

describe("set obligatorio", function () {
    it("mientras el set está en juego no cuenta", function () {
        const entry = rowOf(withChange(), "home", "1").periods[0]
        assert.equal(entry.complete, false)
        assert.equal(entry.live, true)
        assert.equal(entry.period, 1)
    })

    it("cuenta para los titulares que no han salido", function () {
        const table = withChange().burst("home", 25)
        assert.equal(rowOf(table, "home", "1").ok, true, "titular sin cambio: set completo")
        assert.equal(rowOf(table, "home", "3").ok, false, "el titular cambiado no completa el set")
        assert.equal(rowOf(table, "home", "7").ok, false, "el suplente no completa el set")
        assert.equal(rowOf(table, "home", "8").ok, false, "quien no juega no lo cumple")
        assert.equal(rowOf(table, "away", "6").ok, true)
    })

    it("la fila lleva el nombre y si es líbero", function () {
        const table = withChange().burst("home", 25)
        const libero = rowOf(table, "home", "12")
        assert.equal(libero.name, "LIB L")
        assert.equal(libero.libero, true)
        assert.equal(rowOf(table, "home", "1").libero, false)
    })

    it("las marcas a mano mandan sobre el cálculo", function () {
        const table = withChange().burst("home", 25)
        table.play(fullSetMark("home", 7, 1, true))
        table.play(fullSetMark("home", 1, 1, false))
        const seven = rowOf(table, "home", "7")
        assert.equal(seven.ok, true)
        assert.equal(seven.periods[0].manual, true)
        assert.equal(seven.periods[0].auto, false)
        assert.equal(rowOf(table, "home", "1").ok, false)
        assert.equal(rowOf(table, "home", "3").periods[0].manual, null)
    })

    it("solo se marcan sets jugados y jugadores inscritos", function () {
        const table = withChange().burst("home", 25)
        const mark = (shirt, period) => fullSetMark("home", shirt, period, true)
        assert.equal(table.refuse(mark(7, 3)), "Ese set no llegó a jugarse.")
        assert.equal(table.refuse(mark(55, 1)), "El 55 no figura en el acta.")
    })

    it("el golden no cuenta", function () {
        const table = Table.ready(rules, { bestOf: 3, fullSetRule: true }).burst("home", 25)
        table.lineups().start().burst("home", 25)
        table.play({ kind: "openGolden" }).lineups().toss("home", "home").start().burst("home", 15)
        const periods = rowOf(table, "home", "1").periods
        assert.deepEqual(periods.map((entry) => entry.period), [1, 2])
    })
})
