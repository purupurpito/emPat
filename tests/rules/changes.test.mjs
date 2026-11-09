/**
 * Sustituciones regulares y excepcionales, expulsiones que obligan a sustituir y el motivo que
 * la interfaz consulta para decidir si ofrece un cambio.
 * @module tests/rules/changes.test.mjs
 */
import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { loadRules } from "../support/load.mjs"
import { liberoIn, rally, sanction, substitution, timeout } from "../support/plays.mjs"
import { Table, asShirts } from "../support/table.mjs"

const rules = await loadRules()

/**
 * Jugada de sustitución regular del local.
 * @param {number|string} leaving sale
 * @param {number|string} entering entra
 * @returns {object}
 */
function homeSub(leaving, entering) {
    return { kind: "substitution", side: "home", leaving, entering }
}

describe("sustituciones regulares", function () {
    it("el suplente ocupa el sitio del titular y cuenta una", function () {
        const period = Table.ready(rules).play(homeSub(3, 7)).period()
        assert.deepEqual(period.rotation.home, asShirts([1, 2, 7, 4, 5, 6]))
        assert.equal(period.subCount.home, 1)
        assert.deepEqual(period.partners.home, { 3: "7" })
    })

    it("la pareja titular y suplente limita quién vuelve", function () {
        const table = Table.ready(rules).play(homeSub(3, 7))
        assert.match(table.refuse(homeSub(7, 8)), /solo lo puede relevar el 3/)
        assert.match(table.refuse(homeSub(4, 7)), /ya se encuentra en pista/)
        assert.match(table.refuse(homeSub(4, 3)), /titular/)
    })

    it("tras la vuelta el titular no sale más y el suplente no entra por otro", function () {
        const table = Table.ready(rules).play(homeSub(3, 7)).play(homeSub(7, 3))
        assert.deepEqual(table.period().rotation.home, asShirts([1, 2, 3, 4, 5, 6]))
        assert.match(table.refuse(homeSub(3, 8)), /ya ha salido y regresado/)
        assert.match(table.refuse(homeSub(4, 7)), /ya ha jugado en este set/)
        assert.match(table.refuse(homeSub(4, 12)), /líbero/)
        assert.match(table.refuse(homeSub(4, 11)), /no figura en el acta/)
    })

    it("el tope es de seis por set y se reinicia en el siguiente", function () {
        const table = Table.ready(rules).play(homeSub(3, 7)).play(homeSub(7, 3))
        table.play(homeSub(4, 8)).play(homeSub(5, 9)).play(homeSub(6, 10)).play(homeSub(8, 4))
        assert.equal(table.period().subCount.home, 6)
        assert.match(table.refuse(homeSub(9, 5)), /6 sustituciones/)
        table.burst("home", 25).lineups().start().play(homeSub(3, 7))
        assert.equal(table.period().subCount.home, 1)
    })

    it("fuera de juego no hay sustituciones", function () {
        const table = Table.ready(rules).burst("home", 25)
        assert.equal(table.refuse(homeSub(3, 7)),
            "Las sustituciones solo se pueden hacer durante un set.")
    })

    it("el registro guarda el marcador del que cambia primero", function () {
        const table = Table.ready(rules).burst("away", 2)
        const entry = table.play(homeSub(3, 7)).period().substitutions.home[0]
        assert.equal(entry.leaving, "3")
        assert.equal(entry.entering, "7")
        assert.equal(entry.own, 0)
        assert.equal(entry.rival, 2)
        assert.ok(!entry.exceptional)
    })
})

describe("sustitución excepcional", function () {
    it("no cuenta en el tope y el que sale no vuelve en el partido", function () {
        const table = Table.ready(rules)
        table.play(substitution("away", 2, 7))
        table.play(substitution("away", 7, 2))
        table.play(substitution("away", 2, 8, true))
        const match = table.state()
        assert.equal(rules.currentPeriod(match).subCount.away, 2)
        assert.ok(match.outForMatch.away.has("2"))
        assert.equal(rules.summarize(match).rows[0].away.substitutions, 3,
            "en el total del acta sí cuenta (FIVB 15.7)")
        const back = substitution("away", 8, 2)
        assert.match(table.refuse(back), /ya no puede jugar más/)
    })

    it("una sola excepcional no gasta cupo pero aparece en el total", function () {
        const table = Table.ready(rules)
        table.play(substitution("home", 3, 8, true))
        assert.equal(table.period().subCount.home, 0)
        assert.equal(rules.summarize(table.state()).rows[0].home.substitutions, 1)
        assert.equal(table.period().substitutions.home[0].exceptional, true)
    })

    it("no deja entrar a un líbero ni a quien ya está en pista", function () {
        const table = Table.ready(rules)
        const libero = substitution("home", 3, 12, true)
        const onCourt = substitution("home", 3, 4, true)
        assert.equal(table.refuse(libero), "El 12 no está autorizado a entrar.")
        assert.equal(table.refuse(onCourt), "El 4 no está autorizado a entrar.")
    })
})

describe("expulsión", function () {
    it("hay que sustituir al expulsado antes de seguir y no vuelve en el set", function () {
        const table = Table.ready(rules)
        table.play(sanction("away", 3, "expulsion"))
        assert.match(table.refuse(rally("home")), /sustituye al jugador expulsado/)
        table.play(substitution("away", 3, 7))
        table.play(rally("home"))
        const back = substitution("away", 7, 3)
        assert.match(table.refuse(back), /expulsado/)
    })
})

describe("motivo de bloqueo de una sustitución", function () {
    it("da null cuando el cambio es legal", function () {
        const match = Table.ready(rules).state()
        const period = rules.currentPeriod(match)
        assert.equal(rules.substitutionBlocker(match, period, "home", "3", "7"), null)
    })

    it("da el primer motivo en el orden del reglamento", function () {
        const match = Table.ready(rules).play(homeSub(3, 7)).state()
        const period = rules.currentPeriod(match)
        const blocker = (leaving, entering) =>
            rules.substitutionBlocker(match, period, "home", leaving, entering)
        assert.equal(blocker("4", "55"), "El 55 no figura en el acta.")
        assert.equal(blocker("4", "12"),
            "Un líbero no entra por sustitución, sino con un reemplazo del líbero.")
        assert.equal(blocker("3", "8"), "El 3 no se encuentra en pista.")
        assert.equal(blocker("4", "5"), "El 5 ya se encuentra en pista.")
        assert.equal(blocker("4", "3"),
            "El 3 es titular: solo regresa a pista por el suplente que lo sustituyó.")
        assert.equal(blocker("4", "7"), "El 7 ya se encuentra en pista.")
        assert.equal(blocker("7", "8"),
            "Al 7 solo lo puede relevar el 3, el titular al que sustituyó.")
    })

    it("sin nadie que salga, los motivos de quien entra van primero", function () {
        const match = Table.ready(rules).state()
        const period = rules.currentPeriod(match)
        const blocker = (entering) =>
            rules.substitutionBlocker(match, period, "home", null, entering)
        assert.equal(blocker("12"),
            "Un líbero no entra por sustitución, sino con un reemplazo del líbero.")
        assert.equal(blocker("8"), "El null no se encuentra en pista.")
        assert.equal(blocker("4"), "El null no se encuentra en pista.")
    })

    it("el que está fuera por el líbero da su propio motivo", function () {
        const table = Table.ready(rules)
        table.play(liberoIn("away", 12, 5))
        const match = table.state()
        const period = rules.currentPeriod(match)
        assert.equal(rules.substitutionBlocker(match, period, "away", "5", "7"),
            "El 5 está reemplazado por el líbero: antes debe salir el líbero.")
    })

    it("cuenta el tope con el ajuste del partido", function () {
        const table = Table.ready(rules, { substitutions: 1 }).play(homeSub(3, 7))
        const match = table.state()
        const period = rules.currentPeriod(match)
        assert.equal(rules.substitutionBlocker(match, period, "home", "4", "8"),
            "Ya ha agotado las 1 sustituciones del set.")
    })
})

/**
 * Error de programa: un TypeError que no se hace pasar por regla.
 * @param {unknown} error error lanzado
 * @returns {boolean}
 */
function isProgramError(error) {
    return error instanceof TypeError && !(error instanceof rules.RuleViolation)
}

describe("lado desconocido", function () {
    it("una sustitución con un lado inexistente es un error de programa", function () {
        const table = Table.ready(rules)
        assert.throws(() => table.verdict(substitution("x", 3, 7)),
            isProgramError)
    })

    it("un tiempo con un lado que no existe tampoco", function () {
        const table = Table.ready(rules)
        assert.throws(() => table.verdict(timeout("x")),
            isProgramError)
    })
})
