/**
 * Oráculo externo: un acta de prueba publicada por una federación, con cinco sets y 421 pasos
 * numerados, cada uno con el marcador que debe verse después. El guion incluye líberos, cambios
 * dobles, sanciones, demoras, peticiones improcedentes, una repetición y un líbero lesionado y
 * redesignado. Se traduce cada paso a jugadas del motor y se compara el marcador paso a paso.
 *
 * Uso: node tests/oracles/swiss-sheet.mjs [--cache carpeta]
 * Necesita pdftotext. Con --cache guarda el PDF y el texto para no descargarlos otra vez.
 * @module tests/oracles/swiss-sheet.mjs
 */
import { execFileSync } from "node:child_process"
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import { loadRules } from "../support/load.mjs"

/** Dirección pública del documento. */
const SOURCE_URL = "https://www.volleyball.ch/_Resources/Persistent/d/7/9/2/"
    + "d792c82c4b1dab3b32915185823cd3c24c4d543c/eScoresheet-Diktat-%231_2021-09-13_v5.0.pdf"

/** Pasos que tiene el guion completo. */
const EXPECTED_STEPS = 421

/** Marcador final de los cinco sets, local primero. */
const EXPECTED_SETS = "13-25 27-25 25-13 23-25 18-16"

/** Cabecera de cada tabla de pasos: qué equipo va en cada columna de actividad. */
const TABLE_HEADER = new RegExp(
    "Activity\\s+([AB])\\s+\\(TEST Team ([AB])\\)\\s+Activity\\s+([AB])\\s+\\(TEST Team ([AB])\\)",
)

/** Líneas sangradas que no continúan un paso: cabeceras y pies de página. */
const PAGE_FURNITURE = /Swiss Volley|Test-Match|Step|the activity/

/** Cambio de un líbero por el otro, escrito en cualquiera de los dos órdenes. */
const LIBERO_SWAP = /Libero #?\s?\d+ (IN, Libero #?\s?\d+ OUT|OUT, Libero #?\s?\d+ IN)/

/** Equipo del documento → lado del motor. */
const SIDE_OF = Object.freeze({ A: "home", B: "away" })

/**
 * Modos de pdftotext que se prueban en orden: la maquetación de unas versiones y el modo simple
 * de otras dan la misma tabla con columnas alineadas.
 */
const TEXT_MODES = ["-layout", "-simple"]

/**
 * Dorsales numéricos de un texto ("#7", "# 7" o "7").
 * @param {string} text texto
 * @returns {string[]}
 */
function shirtsIn(text) {
    return [...text.matchAll(/#?\s?(\d+)/g)].map((found) => found[1])
}

/**
 * Lee la tabla de pasos del texto del documento. Cada cabecera de tabla dice qué equipo va en
 * cada columna y dónde empiezan las columnas; las líneas sangradas sin número continúan el paso
 * anterior (alineaciones y cambios dobles ocupan varias líneas).
 * @param {string} text texto extraído del PDF
 * @returns {object[]} pasos {number, period, A, B, R, score, columns}
 */
export function parseSteps(text) {
    const steps = []
    let edges = [9, 46, 74, 108]
    let columns = null
    let period = 0
    let current = null
    for (const line of text.split(/\r?\n/)) {
        const header = TABLE_HEADER.exec(line)
        if (header) {
            columns = [header[2], header[4]]
            const first = line.indexOf("Activity")
            const second = line.indexOf("Activity", first + 5)
            edges = [first - 1, second - 1, line.indexOf("Remarks") - 1, line.indexOf("Score") - 1]
            continue
        }
        const periodTitle = /^\s*(\d)(st|nd|rd|th) Set/.exec(line)
        if (periodTitle) {
            period = Number(periodTitle[1])
            continue
        }
        if (/^At the end of the Game/.test(line.trim())) {
            break
        }
        const numbered = /^ (\d{3}) /.exec(line)
        if (numbered && columns) {
            current = readStep(line, edges, columns, period, Number(numbered[1]))
            steps.push(current)
            continue
        }
        if (current && /^\s{9,}\S/.test(line) && !PAGE_FURNITURE.test(line)) {
            appendContinuation(current, line, edges)
        }
    }
    return steps
}

/**
 * Corta una línea numerada en sus columnas.
 * @param {string} line línea
 * @param {number[]} edges inicio de cada columna
 * @param {string[]} columns equipo de cada columna de actividad
 * @param {number} period set en curso
 * @param {number} number número de paso
 * @returns {object}
 */
function readStep(line, edges, columns, period, number) {
    const score = /(\d+)[-:.](\d+)\s*$/.exec(line)
    return {
        number,
        period,
        A: line.slice(edges[0], edges[1]).trim(),
        B: line.slice(edges[1], edges[2]).trim(),
        R: line.slice(edges[2]).replace(/\s*\d+[-:.]\d+\s*$/, "").trim(),
        score: score ? [Number(score[1]), Number(score[2])] : null,
        columns,
    }
}

/**
 * Añade a un paso el texto de una línea de continuación, columna a columna.
 * @param {object} step paso
 * @param {string} line línea
 * @param {number[]} edges inicio de cada columna
 */
function appendContinuation(step, line, edges) {
    const parts = {
        A: { from: edges[0], to: edges[1] },
        B: { from: edges[1], to: edges[2] },
        R: { from: edges[2], to: line.length },
    }
    for (const [key, { from, to }] of Object.entries(parts)) {
        const piece = line.slice(from, to).trim()
        if (piece) {
            step[key] += " " + piece
        }
    }
}

/**
 * Consigue el texto del documento: de la caché si de él salen pasos, o descargando el PDF y
 * pasándolo por pdftotext. Un texto guardado que no se deja leer (por ejemplo, extraído con otra
 * maquetación) se descarta y se sustituye por uno nuevo.
 * @param {string|null} cacheDir carpeta de caché o null
 * @returns {Promise<string|null>} texto, o null si no hay pdftotext
 */
async function documentText(cacheDir) {
    const folder = cacheDir ?? mkdtempSync(join(tmpdir(), "empat-oraculo-"))
    mkdirSync(folder, { recursive: true })
    const textFile = join(folder, "escoresheet.txt")
    try {
        if (cacheDir && existsSync(textFile)) {
            const saved = readFileSync(textFile, "utf8")
            if (parseSteps(saved).length > 0) {
                return saved
            }
        }
        const pdfFile = join(folder, "escoresheet.pdf")
        if (!existsSync(pdfFile)) {
            const response = await fetch(SOURCE_URL)
            writeFileSync(pdfFile, Buffer.from(await response.arrayBuffer()))
        }
        for (const mode of TEXT_MODES) {
            const text = extractText(pdfFile, mode)
            if (text === null) {
                return null
            }
            if (parseSteps(text).length > 0) {
                writeFileSync(textFile, text)
                return text
            }
        }
        return ""
    } finally {
        if (!cacheDir) {
            rmSync(folder, { recursive: true, force: true })
        }
    }
}

/**
 * Ejecuta pdftotext con un modo. Si la herramienta no existe devuelve null; si no conoce el modo
 * devuelve texto vacío para que se pruebe el siguiente.
 * @param {string} pdfFile PDF
 * @param {string} mode opción de maquetación
 * @returns {string|null}
 */
function extractText(pdfFile, mode) {
    const textFile = pdfFile + mode + ".txt"
    try {
        execFileSync("pdftotext", [mode, pdfFile, textFile], { stdio: "ignore" })
    } catch (error) {
        return error.code === "ENOENT" ? null : ""
    }
    const text = readFileSync(textFile, "utf8")
    rmSync(textFile, { force: true })
    return text
}

/**
 * Reproducción del guion sobre el motor: acumula jugadas, problemas y notas.
 */
class Replay {
    #rules
    #clock = Date.parse("2030-01-01T17:00:00Z")

    /** @param {object} rules motor */
    constructor(rules) {
        this.#rules = rules
        this.settings = {}
        this.plays = []
        this.problems = []
        this.notes = []
        this.autoExits = 0
        this.waitingLiberos = []
    }

    /** Partido con las jugadas actuales. */
    state() {
        return this.#rules.replay(this.settings, {}, this.plays)
    }

    /** Periodo actual. */
    period() {
        return this.#rules.currentPeriod(this.state())
    }

    /**
     * Valida una jugada sin aplicarla.
     * @param {object} play jugada
     * @returns {string|null}
     */
    verdict(play) {
        return this.#rules.check(this.settings, {}, this.plays, play)
    }

    /**
     * Aplica una jugada si es legal; si no, la anota como problema.
     * @param {object} play jugada
     * @param {number} step número de paso
     * @param {string} source texto del documento
     * @returns {boolean}
     */
    attempt(play, step, source) {
        this.#clock += 17000
        const stamped = { ...play, at: new Date(this.#clock).toISOString() }
        const verdict = this.verdict(stamped)
        if (verdict !== null) {
            const said = "el motor dice \"" + verdict + "\""
            this.problems.push("paso " + step + " (" + source + "): " + said)
            return false
        }
        this.plays.push(stamped)
        return true
    }

    /**
     * Aplica un cambio de líbero ya, o lo guarda para después del inicio si el set no ha empezado.
     * @param {object} play jugada
     * @param {number} step paso
     * @param {string} source texto
     */
    liberoWhenLive(play, step, source) {
        if (this.state().phase === "live") {
            this.attempt(play, step, source)
            return
        }
        this.waitingLiberos.push([play, step, source])
    }
}

/**
 * Plantillas y sorteo inicial del guion: el equipo A es el local.
 * @returns {object[]}
 */
function openingPlays() {
    const players = (shirts, captain, liberos) => shirts.map((shirt) => ({
        shirt: String(shirt),
        name: "J" + shirt,
        captain: shirt === captain,
        libero: liberos.includes(shirt),
    }))
    return [
        {
            kind: "roster",
            side: "home",
            name: "TEST Team A",
            players: players([1, 2, 3, 4, 6, 7, 8, 9, 10, 11, 12, 13], 1, [12, 13]),
            staff: [{ role: "coach", name: "Coach A" }],
        },
        {
            kind: "roster",
            side: "away",
            name: "TEST Team B",
            players: players([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], 12, [1]),
            staff: [{ role: "coach", name: "Coach B" }],
        },
        { kind: "toss", server: "home", left: "away" },
    ]
}

/**
 * Sorteo descrito en el texto: quién saca y si elige el lado derecho.
 * @param {string} text texto del paso
 * @returns {object} jugada toss
 */
function tossFrom(text) {
    const server = SIDE_OF[/\(TEST Team ([AB])\) will\s+serve/.exec(text)[1]]
    const other = server === "home" ? "away" : "home"
    return { kind: "toss", server, left: /right hand side/.test(text) ? other : server }
}

/**
 * Traduce el texto de una columna de actividad y lo aplica.
 * @param {Replay} replay reproducción
 * @param {object} step paso
 * @param {object[]} steps todos los pasos
 * @param {string} text texto de la columna
 * @param {"home"|"away"} side equipo de la columna
 */
function applyActivity(replay, step, steps, text, side) {
    const index = steps.indexOf(step)
    const next = steps[index + 1]
    const afterNext = steps[index + 2]
    const number = step.number
    if (/^Line-up/.test(text)) {
        const shirts = []
        for (const found of text.matchAll(/Pos (\d): #?\s?(\d+)/g)) {
            shirts[Number(found[1]) - 1] = found[2]
        }
        replay.attempt({ kind: "lineup", side, shirts }, number, text)
    } else if (/^Wins the rally/.test(text)) {
        replay.attempt({ kind: "rally", side }, number, text)
    } else if (/Request for Time-Out/.test(text)) {
        if (next && /improper request/.test(next.R)) {
            const verdict = replay.verdict({ kind: "timeout", side })
            replay.notes.push("paso " + number + ": tiempo de más rechazado (\"" + verdict + "\"); "
                + "el documento lo anota como petición improcedente")
        } else {
            replay.attempt({ kind: "timeout", side }, number, text)
        }
    } else if (/Substitution/.test(text)) {
        applySubstitutions(replay, number, text, side)
    } else if (LIBERO_SWAP.test(text)) {
        const entering = /Libero #?\s?(\d+) IN/.exec(text)[1]
        const leaving = /Libero #?\s?(\d+) OUT/.exec(text)[1]
        replay.liberoWhenLive({ kind: "liberoIn", side, libero: entering, leaving }, number, text)
    } else if (/^Libero #?\s?\d+ IN, #\d+ OUT/i.test(text)) {
        applyLiberoEntry(replay, number, text, side)
    } else if (/^#\d+ IN\s*, Libero #?\s?\d+ OUT/.test(text)) {
        applyLiberoExit(replay, number, text, side)
    } else if (/becomes game captain/.test(text)) {
        replay.notes.push("paso " + number + ": capitán en juego, el anotador no hace nada")
    } else if (/declared unable to play/.test(text)) {
        applyUnable(replay, step, next, afterNext, text, side)
    } else if (/is injured/.test(text)) {
        const successor = next && /Re-designation/.test(next.A + next.B)
            ? /#(\d+) becomes/.exec(next.A + next.B)[1]
            : undefined
        const libero = shirtsIn(text)[0]
        replay.attempt({ kind: "liberoUnfit", side, libero, successor }, number, text)
        step.injuryDone = true
    } else if (/Re-designation/.test(text)) {
        const previous = steps[index - 1]
        if (!previous.injuryDone) {
            const successor = /#(\d+) becomes/.exec(text)[1]
            const play = { kind: "liberoUnfit", side, libero: previous.unable.libero, successor }
            replay.attempt(play, number, text)
        }
    } else {
        applySanctionOrToss(replay, number, text, side)
    }
}

/**
 * Una o dos sustituciones en el mismo paso; si la regular no es legal se intenta la excepcional.
 * @param {Replay} replay reproducción
 * @param {number} number paso
 * @param {string} text texto
 * @param {"home"|"away"} side lado
 */
function applySubstitutions(replay, number, text, side) {
    for (const found of text.matchAll(/#(\d+) IN\s*,\s*#(\d+) OUT/g)) {
        const play = { kind: "substitution", side, leaving: found[2], entering: found[1] }
        if (replay.attempt(play, number, text)) {
            continue
        }
        if (replay.attempt({ ...play, exceptional: true }, number, text + " [excepcional]")) {
            replay.notes.push("paso " + number + ": entra como sustitución excepcional")
        }
    }
}

/**
 * Entrada de líbero por un jugador. Si el motor ya lo puso (redesignación) se anota y se salta.
 * @param {Replay} replay reproducción
 * @param {number} number paso
 * @param {string} text texto
 * @param {"home"|"away"} side lado
 */
function applyLiberoEntry(replay, number, text, side) {
    const [libero, leaving] = shirtsIn(text)
    const current = replay.period().libero[side]
    if (current && current.shirt === libero && current.replacing === leaving) {
        replay.notes.push("paso " + number + ": el líbero redesignado " + libero
            + " ya está en pista")
        return
    }
    replay.liberoWhenLive({ kind: "liberoIn", side, libero, leaving }, number, text)
}

/**
 * Salida de líbero. Si el motor ya lo sacó al rotar a la delantera, se cuenta y se salta.
 * @param {Replay} replay reproducción
 * @param {number} number paso
 * @param {string} text texto
 * @param {"home"|"away"} side lado
 */
function applyLiberoExit(replay, number, text, side) {
    const [back] = shirtsIn(text)
    const period = replay.period()
    const current = period.libero[side]
    if (!current && period.rotation[side] && period.rotation[side].includes(back)) {
        replay.autoExits += 1
        return
    }
    if (!current || current.replacing !== back) {
        const replacing = current ? current.replacing : undefined
        replay.problems.push("paso " + number + ": vuelve el " + back
            + " pero el líbero estaba por el " + replacing)
    }
    replay.attempt({ kind: "liberoOut", side }, number, text)
}

/**
 * Líbero declarado sin poder jugar: si sigue una lesión o una redesignación, la jugada se hace
 * entonces; si no, ahora.
 * @param {Replay} replay reproducción
 * @param {object} step paso
 * @param {object|undefined} next paso siguiente
 * @param {object|undefined} afterNext el de después
 * @param {string} text texto
 * @param {"home"|"away"} side lado
 */
function applyUnable(replay, step, next, afterNext, text, side) {
    step.unable = { libero: shirtsIn(text)[0] }
    const injured = next && /is injured/.test(next.A + next.B)
    const mentions = (later) => later && /Re-designation/.test(later.A + later.B)
    const redesignation = [next, afterNext].find(mentions)
    if (redesignation && !injured) {
        return
    }
    replay.attempt({ kind: "liberoUnfit", side, libero: step.unable.libero }, step.number, text)
}

/**
 * Sanciones, demoras y sorteo escritos en una columna de actividad.
 * @param {Replay} replay reproducción
 * @param {number} number paso
 * @param {string} text texto
 * @param {"home"|"away"} side lado
 */
function applySanctionOrToss(replay, number, text, side) {
    const first = shirtsIn(text)[0]
    const table = [
        { pattern: /Warning \(yellow card\) for Coach/, target: "coach", level: "warning" },
        { pattern: /Warning \(yellow card\) for #/, target: first, level: "warning" },
        { pattern: /Penalty \(red card\) for #/, target: first, level: "penalty" },
        { pattern: /^Expulsion/, target: first, level: "expulsion" },
        { pattern: /^Disqualification/, target: first, level: "disqualification" },
        { pattern: /^Delay Warning/, target: "team", level: "delayWarning" },
        { pattern: /^Delay Penalty/, target: "team", level: "delayPenalty" },
    ]
    for (const { pattern, target, level } of table) {
        if (pattern.test(text)) {
            replay.attempt({ kind: "sanction", side, target, level }, number, text)
            return
        }
    }
    if (/Results of the Coin Toss/.test(text)) {
        replay.attempt(tossFrom(text), number, text)
        return
    }
    replay.problems.push("paso " + number + ": no sé traducir \"" + text + "\"")
}

/**
 * Traduce la columna de observaciones del paso. Devuelve false si el paso no debe compararse.
 * @param {Replay} replay reproducción
 * @param {object} step paso
 * @returns {boolean}
 */
function applyRemarks(replay, step) {
    const text = step.R
    if (/Results of the Coin/.test(text)) {
        replay.attempt(tossFrom(text), step.number, text)
    } else if (/^Start Set/.test(text)) {
        replay.attempt({ kind: "startPeriod" }, step.number, text)
        for (const [play, number, source] of replay.waitingLiberos) {
            replay.attempt(play, number, source)
        }
        replay.waitingLiberos = []
    } else if (/improper request/.test(text)) {
        const side = SIDE_OF[/\(TEST Team ([AB])\)/.exec(text)[1]]
        replay.attempt({ kind: "improper", side }, step.number, text)
    } else if (/revises his\s+decision: replay/.test(text)) {
        const last = replay.plays.at(-1)
        if (last.kind !== "rally") {
            replay.problems.push("paso " + step.number + ": repetición sin tanto anterior")
            return true
        }
        replay.plays.pop()
        replay.notes.push("paso " + step.number
            + ": se quita el último tanto y se anota la repetición")
        replay.attempt({ kind: "replayRally" }, step.number, text)
    } else if (/Confirm end of set/.test(text)) {
        const finished = replay.state().periods.filter((period) => period.winner).at(-1)
        if (!finished || finished.number !== step.period) {
            replay.problems.push("paso " + step.number + ": el set " + step.period
                + " debería haber acabado")
        }
        return false
    }
    return true
}

/**
 * Compara el marcador del motor con el del documento, en el orden de sus columnas.
 * @param {Replay} replay reproducción
 * @param {object} step paso
 */
function compareScore(replay, step) {
    if (!step.score || replay.state().phase !== "live") {
        return
    }
    const score = replay.period().score
    const [first, second] = step.columns.map((team) => score[SIDE_OF[team]])
    if (first !== step.score[0] || second !== step.score[1]) {
        const source = (step.A || step.B || step.R).slice(0, 50)
        replay.problems.push("paso " + step.number + ": marcador " + first + "-" + second
            + ", el documento dice " + step.score.join("-") + " (" + source + ")")
    }
}

/**
 * Reproduce todos los pasos y devuelve el resultado.
 * @param {object} rules motor
 * @param {object[]} steps pasos leídos
 * @returns {Replay}
 */
export function replaySteps(rules, steps) {
    const replay = new Replay(rules)
    replay.plays.push(...openingPlays())
    for (const step of steps) {
        for (const key of ["A", "B"]) {
            if (step[key]) {
                const side = SIDE_OF[step.columns[key === "A" ? 0 : 1]]
                applyActivity(replay, step, steps, step[key], side)
            }
        }
        if (applyRemarks(replay, step)) {
            compareScore(replay, step)
        }
    }
    return replay
}

/**
 * Lee --cache.
 * @param {string[]} args argumentos
 * @returns {string|null}
 */
function cacheOption(args) {
    const index = args.indexOf("--cache")
    return index >= 0 && args[index + 1] ? args[index + 1] : null
}

/**
 * Punto de entrada de la línea de órdenes.
 * @param {string[]} args argumentos
 * @returns {Promise<number>} código de salida
 */
export async function runSwissSheet(args) {
    const text = await documentText(cacheOption(args))
    if (text === null) {
        console.log("AVISO: no se encuentra pdftotext; el oráculo del acta de prueba no se ha"
            + " ejecutado.")
        return 0
    }
    const steps = parseSteps(text)
    const rules = await loadRules()
    const replay = replaySteps(rules, steps)
    const match = replay.state()
    const finished = match.periods.filter((period) => period.winner)
    const sets = finished.map((period) => period.score.home + "-" + period.score.away).join(" ")
    console.log("pasos leídos: " + steps.length + " · jugadas aplicadas: " + replay.plays.length)
    console.log("sets: " + sets + " · ganados " + match.setsWon.home + "-" + match.setsWon.away
        + " · fase " + match.phase)
    console.log("salidas del líbero que el motor ya hace solo: " + replay.autoExits)
    console.log("\nNOTAS:\n" + replay.notes.join("\n"))
    console.log("\nPROBLEMAS (" + replay.problems.length + "):\n" + replay.problems.join("\n"))
    const ok = steps.length === EXPECTED_STEPS && replay.problems.length === 0
        && sets === EXPECTED_SETS && match.phase === "over"
    if (!ok) {
        console.log("\nFALLA")
        return 1
    }
    console.log("\nOK: el motor da lo mismo que el documento en los " + EXPECTED_STEPS + " pasos.")
    return 0
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    process.exitCode = await runSwissSheet(process.argv.slice(2))
}
