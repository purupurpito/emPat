/**
 * Tanda fija de partidos aleatorios dentro de la batería normal: 50 partidos con una semilla
 * conocida, para que cualquier regresión en las invariantes salte sin lanzar el fuzz largo.
 * @module tests/fuzz/random-matches.test.mjs
 */
import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { loadRules } from "../support/load.mjs"
import { mulberry32 } from "../support/prng.mjs"
import { generateMatch, runBatch } from "./random-matches.mjs"

const rules = await loadRules()

describe("partidos aleatorios con semilla fija", function () {
    it("50 partidos sin ninguna invariante rota", function () {
        const totals = runBatch(rules, { games: 50, seed: 4242 })
        const failure = totals.failure
        let detail = ""
        if (failure !== null) {
            detail = failure.text + " · " + JSON.stringify(failure.minimal)
        }
        assert.equal(failure, null, detail)
        assert.equal(totals.games, 50)
    })

    it("la misma semilla genera exactamente el mismo partido", function () {
        const first = generateMatch(rules, mulberry32(99))
        const second = generateMatch(rules, mulberry32(99))
        assert.deepEqual(second.plays, first.plays)
        assert.ok(first.plays.length > 10)
    })

    it("el generador llega a terminar partidos", function () {
        const rng = mulberry32(7)
        let finished = 0
        for (let game = 0; game < 5; game += 1) {
            const generated = generateMatch(rules, rng)
            const match = rules.replay(generated.settings, generated.info, generated.plays)
            if (match.phase === "over") {
                finished += 1
            }
        }
        assert.ok(finished >= 4, "acabados: " + finished)
    })
})
