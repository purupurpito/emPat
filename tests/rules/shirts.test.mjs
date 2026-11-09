/**
 * Dorsales: forma válida, forma canónica y normalización de las jugadas. El corpus recoge los
 * casos frontera que distinguen un texto de un número ("00" frente a "0", ceros a la izquierda,
 * espacios, roles que parecen dorsales).
 * @module tests/rules/shirts.test.mjs
 */
import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { loadRules, loadWebModule } from "../support/load.mjs"

const rules = await loadRules()
const shirts = await loadWebModule("src/rules/shirts.js")

/**
 * Fila del corpus.
 * @param {unknown} input valor de entrada
 * @param {unknown} canonical forma canónica
 * @param {boolean} valid si es un dorsal válido
 * @param {boolean} isText si ya es un dorsal en texto
 * @returns {{input: unknown, canonical: unknown, valid: boolean, isText: boolean}}
 */
function row(input, canonical, valid, isText) {
    return { input, canonical, valid, isText }
}

/** Corpus: valor de entrada, forma canónica, si es válido y si ya es un dorsal en texto. */
const CORPUS = [
    row(null, null, false, false),
    row(undefined, undefined, false, false),
    row("", "", false, false),
    row(" 7 ", "7", true, false),
    row(7, "7", true, false),
    row(0, "0", true, false),
    row("0", "0", true, true),
    row("00", "00", true, true),
    row(" 00 ", "00", true, false),
    row("07", "7", true, true),
    row("007", "007", false, false),
    row(99, "99", true, false),
    row(100, "100", false, false),
    row("1a", "1a", false, false),
    row("E2", "E2", false, false),
    row("equipo", "equipo", false, false),
    row(-1, "-1", false, false),
    row(1.5, "1.5", false, false),
]

describe("corpus de dorsales", function () {
    for (const { input, canonical, valid, isText } of CORPUS) {
        const label = input === undefined ? "undefined" : JSON.stringify(input)
        it(label + " se normaliza a " + String(canonical), function () {
            assert.equal(rules.normalizeShirt(input), canonical)
        })
        it(label + (valid ? " es válido" : " no es válido"), function () {
            assert.equal(rules.isValidShirt(input), valid)
        })
        it(label + (isText ? " es dorsal en texto" : " no es dorsal en texto"), function () {
            assert.equal(rules.isShirt(input), isText)
        })
    }
})

describe("normalización de jugadas", function () {
    it("normaliza los campos de dorsal presentes y no toca los demás", function () {
        const play = { kind: "substitution", side: "home", leaving: 7, entering: " 08 ", at: "t" }
        assert.deepEqual(shirts.normalizePlay(play),
            { kind: "substitution", side: "home", leaving: "7", entering: "8", at: "t" })
    })

    it("devuelve una copia y deja la jugada original intacta", function () {
        const play = { kind: "lineup", side: "away", shirts: [1, "02", 3, 4, 5, "00"] }
        const copy = shirts.normalizePlay(play)
        assert.deepEqual(copy.shirts, ["1", "2", "3", "4", "5", "00"])
        assert.deepEqual(play.shirts, [1, "02", 3, 4, 5, "00"])
        assert.notEqual(copy, play)
    })

    it("el destinatario de una sanción solo se normaliza si parece un dorsal", function () {
        const sanction = (target) => shirts.normalizePlay({ kind: "sanction", target }).target
        assert.equal(sanction(7), "7")
        assert.equal(sanction("07"), "7")
        assert.equal(sanction("coach"), "coach")
        assert.equal(sanction("team"), "team")
        assert.equal(sanction(" 7"), " 7")
    })

    it("respeta los vacíos y los campos ausentes", function () {
        const copy = shirts.normalizePlay({ kind: "liberoUnfit", libero: "012", successor: null })
        assert.equal(copy.libero, "012")
        assert.equal(copy.successor, null)
        assert.equal("shirt" in copy, false)
    })

    it("la expresión de dorsal acepta una o dos cifras", function () {
        assert.equal(shirts.SHIRT_RE.test("9"), true)
        assert.equal(shirts.SHIRT_RE.test("99"), true)
        assert.equal(shirts.SHIRT_RE.test("999"), false)
    })
})
