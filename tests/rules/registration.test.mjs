/**
 * Inscripción: plantillas, dorsales, categorías, topes de jugadores y oficiales, sorteo y
 * formación inicial.
 * @module tests/rules/registration.test.mjs
 */
import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { loadRules } from "../support/load.mjs"
import { lineup, sanction, substitution } from "../support/plays.mjs"
import { Table } from "../support/table.mjs"

const rules = await loadRules()

/**
 * Jugada roster del local con los jugadores indicados.
 * @param {object[]} players jugadores
 * @param {object[]} [staff] cuerpo técnico
 * @returns {object}
 */
function homeRoster(players, staff) {
    const play = { kind: "roster", side: "home", players }
    if (staff) {
        play.staff = staff
    }
    return play
}

/**
 * Jugadores numerados del 1 al n.
 * @param {number} count cuántos
 * @returns {object[]}
 */
function numbered(count) {
    return Array.from({ length: count }, (unused, index) => ({ shirt: index + 1 }))
}

/**
 * Valida una plantilla en un acta vacía.
 * @param {object} play jugada roster
 * @param {object} [settings] ajustes
 * @returns {string|null}
 */
function verdictOf(play, settings = {}) {
    return rules.check(settings, {}, [], play)
}

/**
 * Valida una plantilla del local hecha solo con dorsales.
 * @param {Array<unknown>} shirts dorsales tal como se escriben
 * @returns {string|null}
 */
function shirtsVerdict(shirts) {
    return verdictOf(homeRoster(shirts.map((shirt) => ({ shirt, name: "X" + shirt }))))
}

describe("plantillas", function () {
    it("rechaza dorsales repetidos", function () {
        assert.match(verdictOf(homeRoster([{ shirt: 1 }, { shirt: 1 }])), /mismo dorsal/)
    })

    it("el líbero puede ser capitán (FIVB 5)", function () {
        const players = [{ shirt: 1, captain: true, libero: true }, ...numbered(7).slice(1)]
        assert.equal(verdictOf(homeRoster(players)), null)
    })

    it("como mucho dos líberos y un capitán", function () {
        const liberos = [1, 2, 3].map((shirt) => ({ shirt, libero: true }))
        assert.match(verdictOf(homeRoster(liberos)), /2 líberos/)
        const captains = [{ shirt: 1, captain: true }, { shirt: 2, captain: true }]
        assert.equal(verdictOf(homeRoster(captains)), "Marca un solo capitán.")
    })

    it("la plantilla se guarda con los extras", function () {
        const table = Table.ready(rules)
        assert.equal(table.state(2).teams.home.players.length, 12)
    })

    it("el nombre se conserva si una plantilla nueva no lo trae", function () {
        const table = new Table(rules).enrol("home")
        table.play(homeRoster(numbered(6)))
        assert.equal(table.state().teams.home.name, "CV LOCAL")
    })

    it("se cierra al empezar el partido", function () {
        const table = Table.ready(rules)
        assert.equal(table.refuse(homeRoster(numbered(6))),
            "Con el partido empezado, las plantillas ya no se pueden modificar.")
    })

    it("tope de 14 con líbero, 12 sin él y el que fijen los ajustes", function () {
        assert.equal(verdictOf(homeRoster(numbered(15))),
            "El acta admite 14 jugadores como máximo, líberos incluidos.")
        assert.equal(verdictOf(homeRoster(numbered(14))), null)
        assert.equal(verdictOf(homeRoster(numbered(13)), { liberoAllowed: false }),
            "El acta admite 12 jugadores como máximo.")
        assert.equal(verdictOf(homeRoster(numbered(11)), { rosterLimit: 10 }),
            "El acta admite 10 jugadores como máximo, líberos incluidos.")
    })

    it("como mucho tres oficiales además del primer entrenador", function () {
        const staff = [
            { role: "coach", name: "a" },
            { role: "assistant", name: "b" },
            { role: "assistant2", name: "c" },
            { role: "physio", name: "d" },
            { role: "doctor", name: "e" },
        ]
        assert.match(verdictOf(homeRoster(numbered(12), staff)), /3 oficiales/)
        staff[4].name = ""
        assert.equal(verdictOf(homeRoster(numbered(12), staff)),
            null, "una fila sin nombre no cuenta")
    })
})

describe("dorsales", function () {
    it("valen del 0 al 99 y el 00", function () {
        assert.equal(shirtsVerdict(["0", "00", "1", "99", 7, "08"]), null)
    })

    for (const wrong of ["100", "-1", "A", "", " ", "1.5", 120, null]) {
        it("rechaza " + JSON.stringify(wrong), function () {
            assert.match(shirtsVerdict(["1", wrong]), /Dorsal incorrecto/)
        })
    }

    it("el mensaje lleva el dorsal tal como se escribió y el nombre", function () {
        assert.equal(shirtsVerdict(["1", "544"]),
            "Dorsal incorrecto: \"544\" (X544). Usa un número del 0 al 99, o 00.")
        assert.equal(verdictOf(homeRoster([{ shirt: null }])),
            "Dorsal incorrecto: \"\". Usa un número del 0 al 99, o 00.")
        assert.equal(verdictOf(homeRoster([{ shirt: " 1a " }])),
            "Dorsal incorrecto: \" 1a \". Usa un número del 0 al 99, o 00.")
    })

    it("\"07\" es el mismo dorsal que \"7\", pero \"0\" y \"00\" son distintos", function () {
        assert.match(shirtsVerdict(["7", "07"]), /mismo dorsal/)
        assert.equal(shirtsVerdict(["0", "00"]), null)
    })

    it("se juega con el 00 y el 0 a la vez", function () {
        const shirts = ["00", "0", "1", "2", "3", "4", "5"]
        const players = shirts.map((shirt) => ({ shirt, captain: shirt === "1" }))
        const table = new Table(rules).play({ kind: "roster", side: "home", players })
        table.enrol("away").toss("home", "home").lineup("home", ["00", "1", "2", "3", "4", "5"])
        table.lineup("away").start()
        const swap = substitution("home", "00", "0")
        assert.equal(table.verdict(swap), null, "sale el 00 y entra el 0")
        assert.deepEqual(table.play(swap).period().rotation.home, ["0", "1", "2", "3", "4", "5"])
        const warning = sanction("home", "00", "warning")
        assert.equal(table.verdict(warning), null, "sanción al 00")
    })
})

describe("categoría inferior", function () {
    it("acepta las letras de categoría", function () {
        const players = [...numbered(6), { shirt: 7, category: "C" }, { shirt: 8, category: "J" }]
        assert.equal(verdictOf(homeRoster(players)), null)
    })

    it("rechaza otra letra citando el dorsal sin normalizar", function () {
        const players = [...numbered(6), { shirt: "07", category: "X" }]
        assert.equal(verdictOf(homeRoster(players)),
            "Categoría incorrecta para el 07: elige Y, J, C, I o A.")
        assert.match(verdictOf(homeRoster([...numbered(6), { shirt: 7, category: "X" }])),
            /Categoría incorrecta para el 7/)
    })
})

describe("formación inicial", function () {
    it("seis jugadores inscritos, sin líberos ni repetidos", function () {
        const table = Table.ready(rules)
        const prefix = table.plays.slice(0, 3)
        const tryLineup = (shirts) => rules.check({}, {}, prefix, lineup("home", shirts))
        assert.match(tryLineup([1, 2, 3, 4, 5, 12]), /líbero/)
        assert.equal(tryLineup([1, 2, 3, 4, 5, 12]),
            "El 12 es líbero y no puede formar parte de la formación inicial.")
        assert.match(tryLineup([1, 2, 3, 4, 5]), /6 jugadores/)
        assert.equal(tryLineup([1, 2, 3, 4, 5, 5]),
            "Un mismo dorsal aparece dos veces en la formación inicial.")
        assert.equal(tryLineup([1, 2, 3, 4, 5, 55]), "El 55 no figura en el acta.")
    })

    it("en la preparación cada equipo necesita seis jugadores no líberos", function () {
        const table = new Table(rules).enrol("home")
        table.play({ kind: "roster", side: "away", players: numbered(5) })
        assert.equal(table.refuse(lineup("home", [1, 2, 3, 4, 5, 6])),
            "Cada equipo debe tener como mínimo 6 jugadores sin contar los líberos.")
    })

    it("con el set empezado ya no se cambia, ni hay sorteo ni otro inicio", function () {
        const table = Table.ready(rules)
        assert.equal(table.refuse(lineup("home", [1, 2, 3, 4, 5, 6])),
            "Este set ya ha comenzado.")
        assert.equal(table.refuse({ kind: "toss", server: "home", left: "home" }),
            "El sorteo solo se hace antes del set 1 o del set decisivo.")
        assert.equal(table.refuse({ kind: "startPeriod" }), "Este set ya se está jugando.")
    })
})
