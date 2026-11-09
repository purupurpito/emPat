/**
 * Todos los mensajes de rechazo del motor, con su texto exacto. Cada fila monta la situación
 * mínima que provoca el mensaje; aparte se comprueba que el catálogo TEXT contiene cada plantilla
 * y nada más, sin depender de cómo se llamen sus claves.
 * @module tests/rules/messages.test.mjs
 */
import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { loadRules, loadWebModule } from "../support/load.mjs"
import {
    actingCaptain,
    forfeit,
    fullSetMark,
    liberoIn,
    liberoOut,
    liberoUnfit,
    lineup,
    rally,
    rotationFault,
    sanction,
    timeout,
} from "../support/plays.mjs"
import { Table, liberoPlayer } from "../support/table.mjs"

const rules = await loadRules()
const { TEXT } = await loadWebModule("src/rules/messages.js")

/**
 * Partido listo para jugar.
 * @param {object} [settings] ajustes
 * @returns {Table}
 */
function ready(settings) {
    return Table.ready(rules, settings)
}

/**
 * Partido con el primer set ya ganado por el local, entre sets.
 * @returns {Table}
 */
function afterFirst() {
    return ready().burst("home", 25)
}

/**
 * Partido acabado 3-0.
 * @returns {Table}
 */
function finished() {
    const table = afterFirst()
    table.lineups().start().burst("home", 25)
    return table.lineups().start().burst("home", 25)
}

/**
 * Partido sin líberos inscritos y con el líbero desactivado.
 * @returns {Table}
 */
function withoutLibero() {
    const table = new Table(rules, { liberoAllowed: false }).enrol("home").enrol("away")
    return table.toss("home", "home").lineups().start()
}

/**
 * Valida una plantilla del local sobre un acta vacía.
 * @param {object[]} players jugadores
 * @param {object} [extra] campos añadidos a la jugada
 * @param {object} [settings] ajustes
 * @returns {string|null}
 */
function roster(players, extra = {}, settings = {}) {
    return rules.check(settings, {}, [], { kind: "roster", side: "home", players, ...extra })
}

/**
 * Atajo de sustitución.
 * @param {"home"|"away"} side lado
 * @param {number} leaving sale
 * @param {number} entering entra
 * @param {boolean} [exceptional] si es excepcional
 * @returns {object}
 */
function sub(side, leaving, entering, exceptional = false) {
    const play = { kind: "substitution", side, leaving, entering }
    if (exceptional) {
        play.exceptional = true
    }
    return play
}

/** Roles con nombre para superar el tope de oficiales. */
const STAFF_ROLES = ["coach", "assistant", "physio", "doctor", "masseur"]

/**
 * Jugadores numerados del 1 al n.
 * @param {number} count cuántos
 * @returns {object[]}
 */
function numbered(count) {
    return Array.from({ length: count }, (unused, index) => ({ shirt: index + 1 }))
}

/**
 * Filas: texto exacto y situación que lo provoca.
 * @type {Array<[string, () => string|null]>}
 */
const CASES = []

/**
 * Añade una fila a CASES: el texto exacto y la situación que lo provoca.
 * @param {string} text mensaje esperado
 * @param {() => string|null} provoke situación
 */
function refusal(text, provoke) {
    CASES.push([text, provoke])
}

refusal("No hay ningún set en juego.", () => afterFirst().verdict(rally("home")))
refusal("Primero sustituye al jugador expulsado o descalificado.", () =>
    ready().play(sanction("away", 3, "expulsion"))
    .verdict(rally("home")))
refusal("El 55 no figura en el acta.", () => ready().verdict(sub("home", 4, 55)))
refusal("Un líbero no entra por sustitución, sino con un reemplazo del líbero.", () =>
    ready().verdict(sub("home", 4, 12)))
refusal("El 5 está reemplazado por el líbero: antes debe salir el líbero.", () =>
    ready().play(liberoIn("away", 12, 5)).verdict(sub("away", 5, 7)))
refusal("El 8 no se encuentra en pista.", () => ready().verdict(sub("home", 8, 9)))
refusal("El 4 ya se encuentra en pista.", () => ready().verdict(sub("home", 3, 4)))
refusal("El 2 ya no puede jugar más en este partido.", () =>
    ready().play(sub("away", 2, 8, true)).verdict(sub("away", 8, 2)))
refusal("El 3 está expulsado hasta el final del set.", () => ready().play(sanction("away", 3, "expulsion"))
    .play(sub("away", 3, 7)).verdict(sub("away", 4, 3)))
refusal("Ya ha agotado las 1 sustituciones del set.", () =>
    ready({ substitutions: 1 }).play(sub("home", 3, 7)).verdict(sub("home", 4, 8)))
refusal("El 3 ya ha salido y regresado en este set: no puede salir otra vez.", () =>
    ready().play(sub("home", 3, 7)).play(sub("home", 7, 3)).verdict(sub("home", 3, 8)))
refusal("El 3 es titular: solo regresa a pista por el suplente que lo sustituyó.", () =>
    ready().play(sub("home", 3, 7)).verdict(sub("home", 4, 3)))
refusal("El 7 ya ha jugado en este set: solo puede volver a entrar por el mismo titular al que sustituyó.", () =>
    ready().play(sub("home", 3, 7)).play(sub("home", 7, 3)).verdict(sub("home", 4, 7)))
refusal("El 7 no puede salir mediante una sustitución regular.", () =>
    ready().play(sub("home", 3, 7, true)).verdict(sub("home", 7, 8)))
refusal("Al 7 solo lo puede relevar el 3, el titular al que sustituyó.", () =>
    ready().play(sub("home", 3, 7)).verdict(sub("home", 7, 8)))
refusal("Las sustituciones solo se pueden hacer durante un set.", () =>
    afterFirst().verdict(sub("home", 3, 7)))
refusal("El 12 no está autorizado a entrar.", () => ready().verdict(sub("home", 3, 12, true)))
refusal("Este partido se juega sin líbero.", () => withoutLibero().verdict(liberoIn("home", 7, 5)))
refusal("El líbero solo puede entrar durante un set.", () =>
    afterFirst().verdict(liberoIn("home", 12, 5)))
refusal("El 7 no figura como líbero en el acta.", () => ready().verdict(liberoIn("home", 7, 5)))
refusal("El líbero 12 no está autorizado a jugar.", () => ready().play(sanction("home", 12, "expulsion"))
    .verdict(liberoIn("home", 12, 5)))
refusal("Ya hay un líbero en pista: sácalo antes o cámbialo directamente por el otro líbero.", () =>
    ready().play(liberoIn("home", 12, 6)).burst("away", 1)
    .verdict(liberoIn("home", 13, 5)))
refusal("Ese líbero ya se encuentra en pista.", () => ready().play(liberoIn("home", 12, 6)).burst("away", 1)
    .verdict(liberoIn("home", 12, 12)))
refusal("Debe completarse una jugada entre dos reemplazos del líbero.", () =>
    ready().play(liberoIn("home", 12, 6))
    .verdict(liberoOut("home")))
refusal("El líbero solo reemplaza a zagueros (zonas I, V y VI).", () =>
    ready().verdict(liberoIn("home", 12, 3)))
refusal("El líbero no saca: no puede reemplazar al jugador que tiene el saque.", () =>
    ready().verdict(liberoIn("home", 12, 1)))
refusal("El 9 no se encuentra en pista.", () => ready().verdict(liberoIn("home", 12, 9)))
refusal("Ahora no hay ningún líbero en pista.", () => ready().verdict(liberoOut("home")))
refusal("El líbero 12 ha rotado a la delantera: antes de seguir, apunta su salida.", () =>
    ready({ liberoExitConfirm: true }).play(liberoIn("home", 12, 5)).burst("away", 1).burst("home", 1)
    .verdict(rally("home")))
refusal("El partido ha terminado.", () => finished().verdict(sanction("home", 1, "warning")))
refusal("Indica a quién va la sanción.", () => ready().verdict(sanction("home", "boss", "warning")))
refusal("Este equipo ya fue amonestado: la próxima conducta incorrecta se sanciona "
    + "con penalización.", () => ready().play(sanction("home", 2, "warning"))
    .verdict(sanction("home", 3, "warning")))
refusal("Este equipo ya tiene amonestación por retraso: el próximo retraso es "
    + "penalización por retraso.", () => ready().play(sanction("home", "team", "delayWarning"))
    .verdict(sanction("home", "team", "delayWarning")))
refusal("El primer retraso se sanciona con amonestación por retraso.", () =>
    ready().verdict(sanction("home", "team", "delayPenalty")))
refusal("Con el partido empezado, las plantillas ya no se pueden modificar.", () =>
    ready().verdict({ kind: "roster", side: "home", players: numbered(6) }))
refusal("Dorsal incorrecto: \"x\" (Pepe). Usa un número del 0 al 99, o 00.", () =>
    roster([{ shirt: "x", name: "Pepe" }]))
refusal("Dorsal incorrecto: \"100\". Usa un número del 0 al 99, o 00.", () => roster([{ shirt: 100 }]))
refusal("Hay dos jugadores con el mismo dorsal.", () => roster([{ shirt: 4 }, { shirt: "04" }]))
refusal("Marca un solo capitán.", () =>
    roster([{ shirt: 1, captain: true }, { shirt: 2, captain: true }]))
refusal("Categoría incorrecta para el 8: elige Y, J, C, I o A.", () =>
    roster([{ shirt: 8, category: "Z" }]))
refusal("No puede haber más de 2 líberos.", () => roster([1, 2, 3].map((shirt) => liberoPlayer(shirt, "L"))))
refusal("El acta admite 14 jugadores como máximo, líberos incluidos.", () => roster(numbered(15)))
refusal("El acta admite 12 jugadores como máximo.", () =>
    roster(numbered(13), {}, { liberoAllowed: false }))
refusal("Además del primer entrenador, solo se admiten 3 oficiales más.", () => roster(numbered(6), {
    staff: STAFF_ROLES.map((role) => ({ role, name: role })),
}))
refusal("El formato de este partido no tiene líbero.", () =>
    roster([liberoPlayer(1, "L")], {}, { liberoAllowed: false }))
refusal("El golden set solo se juega con el partido terminado.", () =>
    ready().verdict({ kind: "openGolden" }))
refusal("Ya se ha jugado el golden set.", () => {
    const table = ready({ bestOf: 1 }).burst("home", 25).play({ kind: "openGolden" })
    table.lineups().toss("home", "home").start().burst("home", 15)
    return table.verdict({ kind: "openGolden" })
})
refusal("El capitán en juego solo se designa durante un set.", () =>
    afterFirst().verdict(actingCaptain("home", 2)))
refusal("Este equipo no tiene capitán inscrito en el acta.", () => {
    const roster = { kind: "roster", side: "home", players: numbered(6) }
    const table = new Table(rules).play(roster)
    return table.enrol("away").toss("home", "home").lineups().start()
        .verdict(actingCaptain("home", 2))
})
refusal("El capitán (1) está en pista, así que él es el capitán en juego.", () =>
    ready().verdict(actingCaptain("home", 2)))
refusal("El sorteo solo se hace antes del set 1 o del set decisivo.", () =>
    ready().verdict({ kind: "toss", server: "home", left: "home" }))
refusal("Ahora el sorteo solo corresponde antes del set decisivo.", () =>
    afterFirst().verdict({ kind: "toss", server: "home", left: "home" }))
refusal("Este set ya ha comenzado.", () => ready().verdict(lineup("home", [1, 2, 3, 4, 5, 6])))
refusal("Cada equipo debe tener como mínimo 6 jugadores sin contar los líberos.", () =>
    new Table(rules).enrol("home").verdict(lineup("home", [1, 2, 3, 4, 5, 6])))
refusal("La formación inicial debe tener 6 jugadores.", () =>
    afterFirst().verdict(lineup("home", [1, 2, 3])))
refusal("Un mismo dorsal aparece dos veces en la formación inicial.", () =>
    afterFirst().verdict(lineup("home", [1, 2, 3, 4, 5, "05"])))
refusal("El 12 es líbero y no puede formar parte de la formación inicial.", () =>
    afterFirst().verdict(lineup("home", [1, 2, 3, 4, 5, 12])))
refusal("El 3 no está autorizado a jugar.", () => ready().play(sanction("away", 3, "disqualification"))
    .play(sub("away", 3, 7)).burst("home", 25)
    .verdict(lineup("away", [1, 2, 3, 4, 5, 6])))
refusal("Este set ya se está jugando.", () => ready().verdict({ kind: "startPeriod" }))
refusal("Faltan las formaciones iniciales.", () => afterFirst().verdict({ kind: "startPeriod" }))
refusal("Antes hay que hacer el sorteo.", () => new Table(rules).enrol("home").enrol("away").lineups()
    .verdict({ kind: "startPeriod" }))
refusal("¿A qué equipo va?", () => ready().verdict(rally("x")))
refusal("Los tiempos de descanso solo se conceden durante un set.", () =>
    afterFirst().verdict(timeout("home")))
refusal("Ya ha agotado los 2 tiempos de descanso del set.", () =>
    ready().play(timeout("home")).play(timeout("home"))
    .verdict(timeout("home")))
refusal("Solo se puede anotar durante un set.", () => afterFirst().verdict(rotationFault("home")))
refusal("Indica qué equipo ha cometido la falta.", () => ready().verdict(rotationFault("x")))
refusal("Los puntos del equipo infractor al cometer la falta deben estar entre 0 y 0.", () =>
    ready().verdict(rotationFault("home", 1)))
refusal("Falta indicar el equipo.", () => ready().verdict(forfeit("x")))
refusal("La repetición de la jugada solo se anota durante un set.", () =>
    afterFirst().verdict({ kind: "replayRally" }))
refusal("Solo es posible durante el partido.", () =>
    new Table(rules).enrol("home", [liberoPlayer(12, "L")])
    .verdict(liberoUnfit("home", 12)))
refusal("El 7 no es un líbero.", () => ready().verdict(liberoUnfit("home", 7)))
refusal("El 12 ya no participa en el partido.", () => ready().play(liberoUnfit("home", 12))
    .verdict(liberoUnfit("home", 12)))
refusal("El 13 ya es líbero: no hay que volver a designarlo.", () =>
    ready().verdict(liberoUnfit("home", 12, 13)))
refusal("El 77 no figura en el acta.", () => ready().verdict(liberoUnfit("away", 12, 77)))
refusal("Aún queda el otro líbero, el 13: solo se puede re-designar si él tampoco "
    + "puede jugar (FIVB 19.4.3.1).", () => ready().verdict(liberoUnfit("home", 12, 8)))
refusal("El 2 está en pista: para re-designarlo como líbero tiene que estar fuera.", () =>
    ready().verdict(liberoUnfit("away", 12, 2)))
refusal("El 8 no está autorizado a jugar.", () => ready().play(sanction("away", 8, "disqualification"))
    .verdict(liberoUnfit("away", 12, 8)))
refusal("Ese set no llegó a jugarse.", () => ready().verdict(fullSetMark("home", 1, 2, true)))
refusal("Tipo de jugada no reconocido: dance", () => ready().verdict({ kind: "dance" }))

/**
 * Plantillas de todos los mensajes del motor como expresiones regulares completas. Los huecos
 * admiten cualquier texto no vacío; los dos mensajes con partes opcionales van escritos a mano.
 * @type {RegExp[]}
 */
const TEMPLATES = buildTemplates()

/**
 * Construye TEMPLATES a partir de los textos con huecos marcados como {}.
 * @returns {RegExp[]}
 */
function buildTemplates() {
    const holed = `
        Tipo de jugada no reconocido: {}
        No hay ningún set en juego.
        El partido ha terminado.
        Con el partido empezado, las plantillas ya no se pueden modificar.
        Este set ya se está jugando.
        Este set ya ha comenzado.
        Solo es posible durante el partido.
        Solo se puede anotar durante un set.
        La repetición de la jugada solo se anota durante un set.
        Los tiempos de descanso solo se conceden durante un set.
        Las sustituciones solo se pueden hacer durante un set.
        El líbero solo puede entrar durante un set.
        El capitán en juego solo se designa durante un set.
        ¿A qué equipo va?
        Indica qué equipo ha cometido la falta.
        Falta indicar el equipo.
        Hay dos jugadores con el mismo dorsal.
        Marca un solo capitán.
        Categoría incorrecta para el {}: elige Y, J, C, I o A.
        No puede haber más de 2 líberos.
        Además del primer entrenador, solo se admiten 3 oficiales más.
        El formato de este partido no tiene líbero.
        El sorteo solo se hace antes del set 1 o del set decisivo.
        Ahora el sorteo solo corresponde antes del set decisivo.
        Cada equipo debe tener como mínimo 6 jugadores sin contar los líberos.
        La formación inicial debe tener 6 jugadores.
        Un mismo dorsal aparece dos veces en la formación inicial.
        El {} es líbero y no puede formar parte de la formación inicial.
        El {} no está autorizado a jugar.
        Faltan las formaciones iniciales.
        Antes hay que hacer el sorteo.
        Indica qué equipo saca.
        El golden set solo se juega con el partido terminado.
        Ya se ha jugado el golden set.
        Ese set no llegó a jugarse.
        El {} no figura en el acta.
        El {} no se encuentra en pista.
        El {} ya se encuentra en pista.
        Primero sustituye al jugador expulsado o descalificado.
        Un líbero no entra por sustitución, sino con un reemplazo del líbero.
        El {} está reemplazado por el líbero: antes debe salir el líbero.
        El {} ya no puede jugar más en este partido.
        El {} está expulsado hasta el final del set.
        Ya ha agotado las {} sustituciones del set.
        El {} ya ha salido y regresado en este set: no puede salir otra vez.
        El {} es titular: solo regresa a pista por el suplente que lo sustituyó.
        El {} ya ha jugado en este set: solo puede volver a entrar por el mismo titular al que sustituyó.
        El {} no puede salir mediante una sustitución regular.
        Al {} solo lo puede relevar el {}, el titular al que sustituyó.
        El {} no está autorizado a entrar.
        Este partido se juega sin líbero.
        El {} no figura como líbero en el acta.
        El líbero {} no está autorizado a jugar.
        Ya hay un líbero en pista: sácalo antes o cámbialo directamente por el otro líbero.
        Ese líbero ya se encuentra en pista.
        Debe completarse una jugada entre dos reemplazos del líbero.
        El líbero solo reemplaza a zagueros (zonas I, V y VI).
        El líbero no saca: no puede reemplazar al jugador que tiene el saque.
        Ahora no hay ningún líbero en pista.
        El líbero {} ha rotado a la delantera: antes de seguir, apunta su salida.
        El {} no es un líbero.
        El {} ya no participa en el partido.
        El {} ya es líbero: no hay que volver a designarlo.
        Aún queda el otro líbero, el {}: solo se puede re-designar si él tampoco puede jugar (FIVB 19.4.3.1).
        El {} está en pista: para re-designarlo como líbero tiene que estar fuera.
        Indica a quién va la sanción.
        Este equipo ya fue amonestado: la próxima conducta incorrecta se sanciona con penalización.
        Este equipo ya tiene amonestación por retraso: el próximo retraso es penalización por retraso.
        El primer retraso se sanciona con amonestación por retraso.
        Ya ha agotado los {} tiempos de descanso del set.
        Este equipo no tiene capitán inscrito en el acta.
        El capitán ({}) está en pista, así que él es el capitán en juego.
        Los puntos del equipo infractor al cometer la falta deben estar entre 0 y {}.`
    const templates = []
    for (const line of holed.split("\n")) {
        const text = line.trim()
        if (text === "") {
            continue
        }
        const pattern = text.split("{}").map(escapeRegex).join(".+")
        templates.push(new RegExp("^" + pattern + "$"))
    }
    templates.push(/^Dorsal incorrecto: ".*"( \(.+\))?\. Usa un número del 0 al 99, o 00\.$/)
    templates.push(/^El acta admite .+ jugadores como máximo(, líberos incluidos)?\.$/)
    return templates
}

/**
 * Escapa un texto para usarlo literalmente dentro de una expresión regular.
 * @param {string} text texto
 * @returns {string}
 */
function escapeRegex(text) {
    return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

/** Juegos de argumentos de muestra: unos con datos y otros con valores falsos (cero). */
const SAMPLE_ARGS = [["7", "9", "x"], [0, 0, 0]]

/**
 * Evalúa una entrada de TEXT con los argumentos de muestra y devuelve todos los textos que da.
 * @param {string|Function} entry cadena o función
 * @returns {unknown[]}
 */
function samples(entry) {
    if (typeof entry !== "function") {
        return [entry]
    }
    return SAMPLE_ARGS.map((args) => entry(...args))
}

describe("mensajes del motor", function () {
    for (const [expected, provoke] of CASES) {
        it(expected, function () {
            assert.equal(provoke(), expected)
        })
    }

    it("todas las filas usan una plantilla conocida", function () {
        const known = (text) => TEMPLATES.some((re) => re.test(text))
        const orphans = CASES.map((row) => row[0]).filter((text) => !known(text))
        assert.deepEqual(orphans, [])
    })
})

describe("catálogo TEXT", function () {
    it("es el único sitio de los textos: cada entrada produce una plantilla conocida", function () {
        const unknown = []
        for (const [key, entry] of Object.entries(TEXT)) {
            for (const text of samples(entry)) {
                if (typeof text !== "string" || !TEMPLATES.some((re) => re.test(text))) {
                    unknown.push(key + " → " + String(text))
                }
            }
        }
        assert.deepEqual(unknown, [])
    })

    it("contiene todas las plantillas", function () {
        const produced = Object.values(TEXT).flatMap(samples)
            .filter((text) => typeof text === "string")
        const missing = TEMPLATES.filter((re) => !produced.some((text) => re.test(text)))
        assert.deepEqual(missing.map(String), [])
    })
})
