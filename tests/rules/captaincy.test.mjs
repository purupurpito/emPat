/**
 * Capitán en juego (FIVB 5.1.2): cuándo hay que designarlo, quién puede serlo y cuándo deja de
 * serlo sin que nadie lo diga.
 * @module tests/rules/captaincy.test.mjs
 */
import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { loadRules } from "../support/load.mjs"
import { substitution } from "../support/plays.mjs"
import { Table } from "../support/table.mjs"

const rules = await loadRules()

/**
 * Jugada de capitán en juego del local.
 * @param {number|string} shirt dorsal
 * @returns {object}
 */
function homeActing(shirt) {
    return { kind: "actingCaptain", side: "home", shirt }
}

describe("capitán en juego", function () {
    it("con el capitán en pista no hace falta y no se puede designar a otro", function () {
        const table = Table.ready(rules)
        assert.equal(rules.needsActingCaptain(table.state(), "home"), false)
        assert.equal(table.refuse(homeActing(2)),
            "El capitán (1) está en pista, así que él es el capitán en juego.")
    })

    it("si sale el capitán hay que designar a alguien que esté en pista", function () {
        const table = Table.ready(rules)
        table.play(substitution("home", 1, 7))
        assert.equal(rules.needsActingCaptain(table.state(), "home"), true)
        assert.equal(table.refuse(homeActing(8)), "El 8 no se encuentra en pista.")
        table.play(homeActing(3))
        assert.equal(table.period().actingCaptain.home, "3")
        assert.equal(rules.needsActingCaptain(table.state(), "home"), false)
        const entry = table.state().actingCaptains[0]
        assert.equal(entry.side, "home")
        assert.equal(entry.shirt, "3")
        assert.equal(entry.period, 1)
    })

    it("la marca se borra si sale el designado o si vuelve el capitán", function () {
        const table = Table.ready(rules)
        table.play(substitution("home", 1, 7)).play(homeActing(3))
        table.play(substitution("home", 3, 8))
        assert.equal(table.period().actingCaptain.home,
            null, "si sale el capitán en juego, se borra")
        assert.equal(rules.needsActingCaptain(table.state(), "home"), true)
        table.play(homeActing(2)).burst("home", 1)
        table.play(substitution("home", 7, 1))
        assert.equal(table.period().actingCaptain.home, null, "vuelve el capitán: se borra")
        assert.equal(rules.needsActingCaptain(table.state(), "home"), false)
        assert.equal(table.state().actingCaptains.length, 2)
    })

    it("un capitán líbero en el banquillo no obliga a designar a nadie", function () {
        const homePlayers = [1, 2, 3, 4, 5, 6, 7].map((shirt) => ({ shirt }))
        homePlayers.push({ shirt: 12, libero: true, captain: true })
        const awayPlayers = [1, 2, 3, 4, 5, 6].map((shirt) => ({ shirt, captain: shirt === 1 }))
        const table = new Table(rules)
        table.play({ kind: "roster", side: "home", name: "L", players: homePlayers })
        table.play({ kind: "roster", side: "away", name: "V", players: awayPlayers })
        table.toss("away", "home").lineups().start()
        assert.equal(rules.needsActingCaptain(table.state(), "home"), false)
    })

    it("sin capitán inscrito no se puede designar", function () {
        const players = [1, 2, 3, 4, 5, 6, 7].map((shirt) => ({ shirt }))
        const table = new Table(rules)
        table.play({ kind: "roster", side: "home", players }).enrol("away")
        table.toss("home", "home").lineups().start()
        assert.equal(table.refuse(homeActing(2)), "Este equipo no tiene capitán inscrito en el acta.")
        assert.equal(rules.needsActingCaptain(table.state(), "home"), false)
    })

    it("solo se marca con el set en marcha", function () {
        const table = Table.ready(rules).burst("home", 25)
        assert.equal(table.refuse(homeActing(2)),
            "El capitán en juego solo se designa durante un set.")
        assert.equal(rules.needsActingCaptain(table.state(), "home"), false)
    })
})
