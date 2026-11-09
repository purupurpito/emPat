/**
 * Incidencias: rally repetido, falta de rotación con y sin anulación, equipo incompleto o que no
 * se presenta, y golden set.
 * @module tests/rules/incidents.test.mjs
 */
import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { loadRules } from "../support/load.mjs"
import { forfeit, rally, rotationFault, sanction } from "../support/plays.mjs"
import { Table } from "../support/table.mjs"

const rules = await loadRules()

/**
 * Partido en el que el local va 4-3 tras alternar rachas.
 * @returns {Table}
 */
function fourThree() {
    return Table.ready(rules).burst("home", 3).burst("away", 3).burst("home", 1)
}

/**
 * Marcadores "local-visitante" de todos los periodos.
 * @param {object} match partido
 * @returns {string[]}
 */
function scoreLine(match) {
    return match.periods.map((period) => period.score.home + "-" + period.score.away)
}

describe("rally repetido", function () {
    it("no da tanto ni cambia el saque, pero queda anotado", function () {
        const period = Table.ready(rules).burst("home", 1).play({ kind: "replayRally" }).period()
        assert.deepEqual(period.score, { home: 1, away: 0 })
        assert.equal(period.serving, "home")
        assert.deepEqual([period.replays[0].home, period.replays[0].away], [1, 0])
    })

    it("solo con el set en marcha", function () {
        const table = Table.ready(rules).burst("home", 25)
        assert.equal(table.refuse({ kind: "replayRally" }),
            "La repetición de la jugada solo se anota durante un set.")
    })
})

describe("falta de rotación", function () {
    it("da tanto y saque al rival y queda anotada", function () {
        const match = Table.ready(rules).play(rotationFault("home")).state()
        const period = rules.currentPeriod(match)
        assert.deepEqual(period.score, { home: 0, away: 1 })
        assert.equal(period.serving, "away")
        assert.equal(match.rotationFaults.length, 1)
        assert.equal(match.rotationFaults[0].voided, 0)
        assert.equal(period.rallyLog[0].cause, "rotationFault")
    })

    it("con el momento de la falta anula los tantos posteriores (FIVB 7.7.2)", function () {
        const table = fourThree()
        assert.equal(table.refuse(rotationFault("home", 9)),
            "Los puntos del equipo infractor al cometer la falta deben estar entre 0 y 4.")
        table.play(rotationFault("home", 2))
        const period = table.period()
        assert.deepEqual(period.score,
            { home: 2, away: 4 }, "se anulan 2 tantos locales y el visitante gana 1")
        assert.equal(period.rallyLog.filter((entry) => entry.voided).length, 2)
        const fault = table.state().rotationFaults[0]
        assert.equal(fault.voided, 2)
        assert.equal(fault.own, 2, "se anota con el marcador ya corregido")
        assert.equal(fault.rival, 3)
    })

    it("sin momento solo da el tanto al rival", function () {
        const table = fourThree().play(rotationFault("home", 2))
        table.play(rotationFault("away"))
        assert.deepEqual(table.period().score, { home: 3, away: 4 })
    })

    it("el momento acepta texto numérico, ignora el vacío y rechaza lo demás", function () {
        assert.deepEqual(fourThree().play(rotationFault("home", "2")).period().score,
            { home: 2, away: 4 })
        assert.deepEqual(fourThree().play(rotationFault("home", "")).period().score,
            { home: 4, away: 4 })
        assert.equal(fourThree().refuse(rotationFault("home", "x")),
            "Los puntos del equipo infractor al cometer la falta deben estar entre 0 y 4.")
        assert.equal(fourThree().refuse(rotationFault("home", 1.5)),
            "Los puntos del equipo infractor al cometer la falta deben estar entre 0 y 4.")
    })

    it("pide un lado válido y el set en marcha", function () {
        assert.equal(Table.ready(rules).refuse(rotationFault("x")),
            "Indica qué equipo ha cometido la falta.")
        assert.equal(Table.ready(rules).burst("home", 25).refuse(rotationFault("home")),
            "Solo se puede anotar durante un set.")
    })
})

describe("equipo incompleto o que no se presenta", function () {
    it("a mitad de partido el rival gana lo que falta", function () {
        const table = Table.ready(rules).burst("home", 10).burst("away", 12)
        table.play(forfeit("home", "shortHanded"))
        const match = table.state()
        assert.equal(match.phase, "over")
        assert.deepEqual(match.setsWon, { home: 0, away: 3 })
        assert.deepEqual(match.periods[0].score,
            { home: 10, away: 25 }, "el set en juego: el rival suma lo que falta")
        assert.deepEqual(match.periods[1].score, { home: 0, away: 25 })
        assert.equal(match.forfeit.reason, "shortHanded")
        assert.equal(match.forfeit.side, "home")
        assert.equal(match.forfeit.home, 10)
        assert.equal(match.forfeit.away, 12)
        assert.equal(match.periods[1].rallyLog[0].cause, "forfeit")
        assert.equal(table.refuse(rally("home")), "No hay ningún set en juego.")
    })

    it("sin presentarse antes de empezar: 3-0 con 25-0", function () {
        const table = new Table(rules).enrol("home").enrol("away")
        const match = table.play(forfeit("away", "noShow")).state()
        assert.deepEqual(match.setsWon, { home: 3, away: 0 })
        assert.deepEqual(scoreLine(match), ["25-0", "25-0", "25-0"])
        assert.equal(match.forfeit.reason, "noShow")
        assert.equal(rules.summarize(match).winner, "home")
    })

    it("con el set ajustado el rival necesita dos de ventaja", function () {
        const table = Table.ready(rules).burst("home", 24).burst("away", 23)
        table.play(forfeit("home"))
        assert.deepEqual(table.state().periods[0].score, { home: 24, away: 26 })
        assert.equal(table.state().forfeit.reason, "shortHanded", "sin motivo, incompleto")
    })

    it("un motivo desconocido se trata como incompleto", function () {
        const table = new Table(rules).enrol("home").enrol("away")
        table.play(forfeit("home", "whatever"))
        assert.equal(table.state().forfeit.reason, "shortHanded")
    })

    it("en el decisivo sin sorteo cambia de campo sin anotarlo y saca el ganador", function () {
        const table = Table.ready(rules, { bestOf: 3 }).burst("home", 25)
        table.lineups().start().burst("away", 25)
        const match = table.play(forfeit("away")).state()
        const decider = match.periods[2]
        assert.deepEqual(decider.score, { home: 15, away: 0 })
        assert.equal(decider.firstServer, "home")
        assert.equal(decider.switched, true)
        assert.equal(decider.leftSide, "away")
        assert.equal(match.automatic.filter((entry) => entry.kind === "courtSwitch").length, 0)
    })

    it("vacía los castigos pendientes; no vale con el partido acabado ni sin lado", function () {
        const table = Table.ready(rules).burst("home", 25)
        table.play(sanction("home", "coach", "penalty"))
        table.play(forfeit("home"))
        assert.deepEqual(table.state().pendingPenalties, [])
        assert.equal(table.refuse(forfeit("away")), "El partido ha terminado.")
        assert.equal(Table.ready(rules).refuse(forfeit("x")), "Falta indicar el equipo.")
    })
})

describe("golden set", function () {
    const settings = { bestOf: 3, setPoints: 5, deciderPoints: 15 }

    /**
     * Partido acabado 2-0 con sets a 5, listo para el golden.
     * @returns {Table}
     */
    function decided() {
        return Table.ready(rules, settings).burst("home", 5).lineups().start().burst("home", 5)
    }

    it("solo se abre con el partido acabado", function () {
        assert.match(Table.ready(rules, settings).refuse({ kind: "openGolden" }),
            /con el partido terminado/)
        const match = decided().state()
        assert.equal(match.phase, "over")
        assert.deepEqual(match.setsWon, { home: 2, away: 0 })
    })

    it("abre un periodo decisivo nuevo que exige sorteo", function () {
        const table = decided().play({ kind: "openGolden" })
        const match = table.state()
        assert.equal(match.phase, "break")
        assert.equal(match.endedAt, null)
        const golden = rules.currentPeriod(match)
        assert.ok(golden.isGolden && golden.decider)
        assert.equal(golden.number, 3)
        assert.deepEqual(match.golden, { period: 3, winner: null })
        assert.match(table.lineups().refuse({ kind: "startPeriod" }), /sorteo/)
    })

    it("se juega a 15 con cambio a los 8 y no cambia el resultado del partido", function () {
        const table = decided().play({ kind: "openGolden" }).lineups().toss("away", "home").start()
        assert.equal(table.burst("away", 8).period().leftSide, "away", "cambio de campo a los 8")
        const match = table.burst("away", 7).state()
        assert.equal(match.phase, "over")
        assert.deepEqual(match.golden, { period: 3, winner: "away" })
        assert.deepEqual(match.setsWon, { home: 2, away: 0 }, "el partido sigue 2-0")
        assert.equal(match.endedAt, match.periods[2].endedAt)
        const summary = rules.summarize(match)
        assert.equal(summary.rows.length, 2)
        assert.equal(summary.winner, "home")
        assert.equal(summary.golden.winner, "away")
        assert.deepEqual(summary.golden.points, { home: 0, away: 15 })
        assert.equal(summary.endedAt, match.periods[1].endedAt)
        assert.match(table.refuse({ kind: "openGolden" }), /se ha jugado el golden set/)
    })

    it("no hay golden tras una incomparecencia", function () {
        const table = new Table(rules, settings).enrol("home").enrol("away")
        table.play(forfeit("away", "noShow"))
        assert.equal(table.refuse({ kind: "openGolden" }),
            "El golden set solo se juega con el partido terminado.")
    })
})
