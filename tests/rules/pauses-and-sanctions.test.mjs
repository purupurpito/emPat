/**
 * Tiempos de descanso, sanciones de conducta y de demora, descalificación y peticiones
 * improcedentes (FIVB 15.4, 16 y 21).
 * @module tests/rules/pauses-and-sanctions.test.mjs
 */
import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { loadRules } from "../support/load.mjs"
import { liberoIn, lineup, rally, substitution, timeout } from "../support/plays.mjs"
import { Table } from "../support/table.mjs"

const rules = await loadRules()

/**
 * Jugada de sanción.
 * @param {"home"|"away"} side lado sancionado
 * @param {number|string} target dorsal, rol o "team"
 * @param {string} level nivel
 * @returns {object}
 */
function sanction(side, target, level) {
    return { kind: "sanction", side, target, level }
}

describe("tiempos de descanso", function () {
    it("dos por set; el tercero se rechaza", function () {
        const table = Table.ready(rules).burst("away", 1)
        table.play(timeout("home")).play(timeout("home"))
        assert.match(table.refuse(timeout("home")), /2 tiempos/)
    })

    it("el marcador del tiempo empieza por el del equipo que lo pide", function () {
        const table = Table.ready(rules).burst("away", 1).play(timeout("home"))
        const entry = table.period().timeouts.home[0]
        assert.deepEqual(entry, { own: 0, rival: 1, at: entry.at })
    })

    it("el tope sale de los ajustes", function () {
        const table = Table.ready(rules, { timeouts: 1 }).play(timeout("away"))
        assert.equal(table.refuse(timeout("away")),
            "Ya ha agotado los 1 tiempos de descanso del set.")
    })

    it("fuera de juego no hay tiempos", function () {
        const table = Table.ready(rules).burst("home", 25)
        assert.equal(table.refuse(timeout("home")),
            "Los tiempos de descanso solo se conceden durante un set.")
    })
})

describe("amonestación tras castigo o expulsión de otro miembro del equipo", function () {
    it("la amarilla sigue disponible, pero solo una por equipo", function () {
        const table = Table.ready(rules)
        table.play(sanction("home", 5, "penalty")).play(sanction("home", 7, "expulsion"))
        assert.equal(table.verdict(sanction("home", 3, "warning")), null)
        table.play(sanction("home", 3, "warning"))
        assert.match(table.refuse(sanction("home", "coach", "warning")),
            /ya fue amonestado/)
    })
})

describe("sanciones de conducta y de demora", function () {
    it("una amonestación por equipo; el castigo da tanto y saque al rival", function () {
        const table = Table.ready(rules).play(sanction("home", 4, "warning"))
        assert.match(table.refuse(sanction("home", "coach", "warning")),
            /ya fue amonestado/)
        const period = table.play(sanction("home", "coach", "penalty")).period()
        assert.deepEqual(period.score, { home: 0, away: 1 })
        assert.equal(period.serving, "away")
        assert.equal(period.rallyLog[0].cause, "penalty")
    })

    it("la primera demora es un aviso y la siguiente, castigo", function () {
        const table = Table.ready(rules).play(sanction("home", "coach", "penalty"))
        assert.equal(table.refuse(sanction("away", "team", "delayPenalty")),
            "El primer retraso se sanciona con amonestación por retraso.")
        table.play(sanction("away", "team", "delayWarning"))
        assert.match(table.refuse(sanction("away", "team", "delayWarning")),
            /ya tiene amonestación por retraso/)
        const period = table.play(sanction("away", "team", "delayPenalty")).period()
        assert.deepEqual(period.score, { home: 1, away: 1 })
        assert.equal(period.rallyLog.at(-1).cause, "delayPenalty")
    })

    it("cada sanción guarda el marcador de antes, empezando por el del sancionado", function () {
        const table = Table.ready(rules).play(sanction("home", 4, "warning"))
        table.play(sanction("home", "coach", "penalty"))
        table.play(sanction("away", "team", "delayWarning"))
        table.play(sanction("away", "team", "delayPenalty"))
        const sanctions = table.state().sanctions
        assert.equal(sanctions.length, 4)
        const penalty = sanctions[1]
        assert.deepEqual([penalty.own, penalty.rival], [0, 0], "marcador antes del castigo")
        assert.deepEqual([sanctions[3].own, sanctions[3].rival], [1, 0])
        assert.equal(sanctions[0].target, "4")
        assert.equal(sanctions[1].target, "coach")
        assert.equal(sanctions[2].target, "team")
    })

    it("rechaza un destinatario desconocido y toda sanción tras el final", function () {
        const table = Table.ready(rules, { bestOf: 1 })
        assert.equal(table.refuse(sanction("home", "boss", "warning")), "Indica a quién va la sanción.")
        assert.equal(table.refuse(sanction("home", 55, "warning")), "El 55 no figura en el acta.")
        table.burst("home", 25)
        assert.equal(table.state().phase,
            "over", "con un solo set, el primero no es decisivo y va a 25")
        assert.equal(table.refuse(sanction("home", 4, "warning")), "El partido ha terminado.")
    })

    it("antes del partido también se aceptan sanciones", function () {
        const table = new Table(rules).enrol("home").enrol("away")
        table.play(sanction("home", "coach", "warning"))
        assert.equal(table.state().warned.home, true)
    })
})

describe("descalificación", function () {
    it("hay que sustituirlo y no vuelve en todo el partido", function () {
        const table = Table.ready(rules).play(sanction("away", 3, "disqualification"))
        const match = table.state()
        assert.ok(match.disqualified.away.has("3"))
        assert.deepEqual(rules.currentPeriod(match).mustReplace.away, ["3"])
        assert.match(table.refuse(rally("home")), /sustituye/)
        table.play(substitution("away", 3, 7))
        assert.deepEqual(table.period().mustReplace.away, [])
        table.burst("home", 1)
        assert.equal(table.refuse(substitution("away", 7, 3)),
            "El 3 ya no puede jugar más en este partido.")
        table.burst("home", 24)
        assert.equal(table.refuse(lineup("away", [1, 2, 3, 4, 5, 6])),
            "El 3 no está autorizado a jugar.")
    })

    it("el líbero descalificado en pista sale y vuelve su jugador sin más", function () {
        const table = Table.ready(rules).play(liberoIn("away", 12, 5))
        table.burst("home", 1).play(sanction("away", 12, "disqualification"))
        const period = table.period()
        assert.equal(period.libero.away, null)
        assert.deepEqual(period.mustReplace.away, [])
        assert.equal(period.liberoSwaps.away.at(-1).entering, "5")
        assert.equal(period.rallyCount, 1)
        assert.equal(period.lastLiberoRally.away,
            0, "la salida por sanción no cuenta como reemplazo")
    })
})

describe("petición improcedente", function () {
    it("se anota como sanción del equipo sin mirar la fase", function () {
        const table = Table.ready(rules).burst("away", 2).play({ kind: "improper", side: "home" })
        const match = table.state()
        assert.equal(match.improperCount.home, 1)
        const entry = match.sanctions[0]
        assert.equal(entry.side, "home")
        assert.equal(entry.target, "team")
        assert.equal(entry.level, "improper")
        assert.equal(entry.period, 1)
        assert.equal(entry.own, 0)
        assert.equal(entry.rival, 2)
        table.burst("home", 25)
        table.play({ kind: "improper", side: "away" })
        assert.equal(table.state().improperCount.away, 1)
    })
})
