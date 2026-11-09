/**
 * Utilidades del núcleo: bus, formatos, colores, descripción de jugadas y vistas comunes.
 * @module tests/app/helpers.test.mjs
 */

import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { loadSource } from "./fakes.mjs"

const { Bus } = await loadSource("app/bus.js")
const format = await loadSource("app/format.js")
const colors = await loadSource("app/colors.js")
const { describePlay } = await loadSource("app/describe.js")
const common = await loadSource("app/views/common.view.js")
const { fatalView } = await loadSource("app/views/fatal.view.js")
const constants = await loadSource("app/constants.js")

const MATCH = { info: { homeName: "Norte", awayName: "Sur" } }

describe("bus", () => {
    it("reparte en orden de alta y permite darse de baja", () => {
        const bus = new Bus()
        const seen = []
        const off = bus.on("t", (value) => seen.push("a" + value))
        bus.on("t", (value) => seen.push("b" + value))
        bus.emit("t", 1)
        off()
        bus.emit("t", 2)
        bus.emit("nadie")
        assert.deepEqual(seen, ["a1", "b1", "b2"])
    })
})

describe("formatos", () => {
    it("pone mayúscula tras espacio, apóstrofo, punto volado, paréntesis y guion", () => {
        assert.equal(format.properCase("JOAN D'ORS GARCÍA-PONS (cap) l·lo"),
            "Joan D'Ors García-Pons (Cap) L·Lo")
        assert.equal(format.properCase(null), "")
    })

    it("la etiqueta corta es la primera palabra hasta once letras", () => {
        assert.equal(format.shortLabel("  Maximiliano Pérez"), "Maximiliano")
        assert.equal(format.shortLabel("Bartolomeuuuu X"), "Bartolomeuu")
        assert.equal(format.shortLabel(undefined), "")
    })

    it("la hora sale vacía sin marca", () => {
        assert.equal(format.clockTime(null), "")
        assert.match(format.clockTime("2030-01-01T10:05:00Z"), /^\d\d:\d\d$/)
    })

    it("ordinales en los dos idiomas", () => {
        assert.equal(format.ORDINALS.es[3], "3er")
        assert.equal(format.ORDINALS.ca[5], "5è")
    })
})

describe("colores", () => {
    it("usa el color guardado solo si es hexadecimal completo", () => {
        assert.equal(colors.pickColor({ homeColor: "#abcdef" }, "homeColor"), "#abcdef")
        assert.equal(colors.pickColor({ homeColor: "red" }, "homeColor"), "#1F3A93")
        assert.equal(colors.pickColor(null, "awayLiberoColor"), "#DB2777")
        assert.equal(colors.teamColor({}, "away", true), "#DB2777")
    })

    it("texto negro sobre claro y blanco sobre oscuro", () => {
        assert.equal(colors.inkFor("#FFFFFF"), "#000")
        assert.equal(colors.inkFor("#1F3A93"), "#fff")
        assert.equal(colors.colorVars({}, "home"), "--chip-bg:#1F3A93;--chip-ink:#fff")
    })
})

describe("descripción de jugadas", () => {
    const cases = [
        [{ kind: "rally", side: "home" }, "Punto para Norte"],
        [{ kind: "rally", side: "away", cause: "delayPenalty" }, "Punto para Sur (penalización por retraso)"],
        [{ kind: "rally", side: "away", cause: "forfeit" }, "Punto para Sur (equipo incompleto)"],
        [{ kind: "substitution", side: "home", leaving: "4", entering: "9", exceptional: true },
            "Sustitución excepcional de Norte: entra 9 por 4"],
        [{ kind: "sanction", side: "away", level: "warning", target: "7" },
            "Amonestación al 7 · Sur"],
        [{ kind: "sanction", side: "away", level: "penalty", target: "team" },
            "Penalización al equipo · Sur"],
        [{ kind: "sanction", side: "home", level: "expulsion", target: "assistant" },
            "Expulsión al entrenador asistente · Norte"],
        [{ kind: "rotationFault", side: "home", rollbackTo: 3 },
            "Norte comete falta de rotación; punto para Sur (se le anulan los puntos desde el 3)"],
        [{ kind: "rotationFault", side: "home", rollbackTo: null },
            "Norte comete falta de rotación; punto para Sur"],
        [{ kind: "forfeit", side: "away", reason: "noShow" }, "Incomparecencia de Sur"],
        [{ kind: "forfeit", side: "away", reason: "shortHanded" }, "Equipo incompleto: Sur"],
        [{ kind: "liberoUnfit", side: "home", libero: "1", successor: "5" },
            "Norte: líbero 1 incapacitado para jugar · nuevo líbero re-designado: 5"],
        [{ kind: "fullSetMark", side: "home", shirt: "8", period: 2, value: false },
            "Se desmarca el set 2 del 8 (Norte) como completo"],
        [{ kind: "actingCaptain", side: "away", shirt: "3" }, "Sur: capitán en juego, el 3"],
        [{ kind: "mystery" }, "mystery"],
    ]
    for (const [play, text] of cases) {
        it(text, () => {
            assert.equal(describePlay(play, MATCH), text)
        })
    }
})

describe("vistas comunes", () => {
    it("pasos con el actual marcado y los anteriores hechos", () => {
        const markup = String(common.stepper("break"))
        assert.match(markup, /^<ol class="stepper" aria-label="Progreso del acta">/)
        assert.match(markup, /<li class="stepper-done"><span class="stepper-num" aria-hidden="true">✓/)
        assert.match(markup, /<li class="stepper-current" aria-current="step"><span class="stepper-num" aria-hidden="true">4<\/span><span class="stepper-label">Partido<\/span><\/li><li class="">/)
    })

    it("puntos gastados", () => {
        const markup = String(common.usageDots({ used: 1, max: 2, label: "Sustituciones" }))
        assert.equal(markup, "<span class=\"pips\" role=\"img\" aria-label=\"Sustituciones: 1 de 2\">"
            + "<i class=\"pip-lit\"></i><i class=\"\"></i></span>")
    })

    it("selector de lado con nombres escapados", () => {
        const markup = String(common.sidePicker({
            name: "server",
            selected: "away",
            info: { homeName: "A&B", awayName: "C" },
        }))
        assert.equal(markup, "<div class=\"pills\" role=\"radiogroup\"><label><input type=\"radio\" "
            + "name=\"server\" value=\"home\"><span>A&amp;B</span></label><label><input "
            + "type=\"radio\" name=\"server\" value=\"away\" checked><span>C</span></label></div>")
    })

    it("firmas hechas y pendientes", () => {
        const markup = String(common.signatureGrid({
            slots: ["referee1", "scorer"],
            signatures: { scorer: { signer: "Núria", image: "data:x", at: null } },
        }))
        assert.match(markup, /data-sign-slot="referee1" data-sign-label="1er árbitro">Firmar</)
        assert.match(markup, /<img src="data:x" alt="Firma de Anotador"><div class="fine dim">Núria · <\/div>/)
        assert.match(markup, /Repetir firma<\/button><\/div><\/div>$/)
    })

    it("tabla de resultados con totales y golden set", () => {
        const side = (points) => ({ timeouts: 1, substitutions: 2, won: 1, points })
        const markup = String(common.resultsTable({
            info: { homeName: "Norte", awayName: "Sur" },
            summary: {
                rows: [{ period: 1, minutes: 20, home: side(25), away: side(20) }],
                totals: { minutes: 20, home: side(25), away: side(20) },
                startedAt: null,
                endedAt: null,
                matchMinutes: null,
                golden: { winner: "away", minutes: null, points: { home: 10, away: 15 } },
            },
        }))
        assert.match(markup, /<tbody>\n {4}<tr><td>1<\/td><td>20<\/td><td><b>25<\/b><\/td><td class="fine dim">TD 1 · S 2<\/td>/)
        assert.match(markup, /<\/tr>\n {4}<tr><td><b>Total<\/b><\/td><td>20<\/td>/)
        assert.match(markup, /<p class="fine dim">Comienzo {2}· final {2}· el partido ha durado {2}min\.<\/p>\n {4}<p>/)
        assert.match(markup, /<p><b>Golden set<\/b>: ganador: Sur · Norte 10 – 15 Sur<\/p>$/)
    })

    it("pantalla de error con y sin acta", () => {
        const withRecord = String(fatalView({ withRecord: true, detail: "<x>" }))
        assert.match(withRecord, /Esta versión de la aplicación no puede mostrar el acta\. No se ha perdido nada/)
        assert.match(withRecord, /Detalle del error: &lt;x&gt;/)
        assert.match(withRecord, /id="fatal-download"/)
        const bare = String(fatalView({ withRecord: false, detail: "x" }))
        assert.doesNotMatch(bare, /fatal-download/)
        assert.match(bare, /Algo ha fallado al cargar la aplicación\./)
    })
})

describe("constantes", () => {
    it("pistas, firmas y clave", () => {
        assert.deepEqual(constants.COURT_ORDER.mini, [3, 2, 1, 4, 5, 0])
        assert.equal(constants.CLOSING_SIGNERS.length, 6)
        assert.equal(constants.SEAL_PIN, "0000")
        assert.equal(constants.SANCTION_LABELS.delayPenalty, "Penalización por retraso")
        assert.equal(constants.FULL_SET_MARKS.disqualification, "D")
    })
})
