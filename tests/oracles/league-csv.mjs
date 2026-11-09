/**
 * Oráculo externo: partidos reales de una liga profesional publicados en dos CSV abiertos (el
 * registro de sucesos del acta y el punto a punto). Cada partido se reconstruye con el motor y se
 * compara el marcador de cada set, el final del partido y quién saca cada punto. Hay diferencias
 * conocidas que vienen de incoherencias entre los dos archivos, por eso se pide un mínimo de
 * partidos idénticos y no la totalidad.
 *
 * Uso: node tests/oracles/league-csv.mjs [--data carpeta] [--minimum N] [--detail]
 * Si en la carpeta no están los CSV, se descargan allí.
 * @module tests/oracles/league-csv.mjs
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import { loadRules } from "../support/load.mjs"

/** Carpeta pública de descargas de los datos. */
const RELEASES = "https://github.com/awosoga/volleydata/releases/download/"

/** Archivos de datos y su dirección de descarga. */
const SOURCES = Object.freeze({
    events: [
        "pvf_events_log_2026.csv",
        RELEASES + "pvf-events-log/pvf_events_log_2026.csv",
    ],
    rallies: [
        "pvf_pbp_2026.csv",
        RELEASES + "pvf-pbp/pvf_pbp_2026.csv",
    ],
})

/** Hora simulada de la primera jugada de cada partido. */
const MATCH_CLOCK = Date.parse("2030-01-01T18:00:00Z")

/** Partidos idénticos exigidos si no se indica otra cosa. */
const DEFAULT_MINIMUM = 114

/**
 * Lee un CSV con comillas dobles y devuelve una fila por objeto, con "NA" convertido en null.
 * @param {string} text contenido
 * @returns {object[]}
 */
export function parseCsv(text) {
    const rows = []
    let row = []
    let field = ""
    let quoted = false
    for (let index = 0; index < text.length; index += 1) {
        const char = text[index]
        if (quoted) {
            if (char !== "\"") {
                field += char
            } else if (text[index + 1] === "\"") {
                field += "\""
                index += 1
            } else {
                quoted = false
            }
            continue
        }
        if (char === "\"") {
            quoted = true
        } else if (char === ",") {
            row.push(field)
            field = ""
        } else if (char === "\n") {
            row.push(field)
            rows.push(row)
            row = []
            field = ""
        } else if (char !== "\r") {
            field += char
        }
    }
    if (field || row.length > 0) {
        row.push(field)
        rows.push(row)
    }
    const [header, ...body] = rows
    return body
        .filter((cells) => cells.length > 1)
        .map((cells) => Object.fromEntries(header.map((key, at) => [key, cellValue(cells[at])])))
}

/**
 * Valor de una celda: "NA" significa que no hay dato.
 * @param {string|undefined} cell texto de la celda
 * @returns {string|null|undefined}
 */
function cellValue(cell) {
    return cell === "NA" ? null : cell
}

/**
 * Agrupa filas por partido conservando el orden.
 * @param {object[]} rows filas
 * @returns {Map<string, object[]>}
 */
function byMatch(rows) {
    const groups = new Map()
    for (const row of rows) {
        if (!groups.has(row.match_id)) {
            groups.set(row.match_id, [])
        }
        groups.get(row.match_id).push(row)
    }
    return groups
}

/**
 * Sacador real de cada punto: la primera acción de saque de cada set y punto.
 * @param {object[]} rows punto a punto del partido
 * @returns {Map<string, {side: string, shirt: string}>}
 */
function realServers(rows) {
    const servers = new Map()
    for (const row of rows) {
        const key = row.set + "|" + row.point_number
        if (row.action === "S" && !servers.has(key)) {
            servers.set(key, { side: row.team_involved, shirt: row.jersey_number })
        }
    }
    return servers
}

/**
 * Plantillas deducidas de los datos: todos los dorsales que aparecen; son líberos los que entran
 * como líbero.
 * @param {object[]} events sucesos del partido
 * @param {object[]} rallies punto a punto del partido
 * @returns {object[]} dos jugadas roster
 */
function inferRosters(events, rallies) {
    const shirts = { home: new Set(), away: new Set() }
    const liberos = { home: new Set(), away: new Set() }
    for (const row of events) {
        for (let zone = 1; zone <= 6; zone += 1) {
            for (const side of ["home", "away"]) {
                const starter = row[side + "_team_starter_position_" + zone]
                if (starter) {
                    shirts[side].add(starter)
                }
            }
        }
        const side = row.team_involved
        if (row.event_type === "libero" && shirts[side]) {
            liberos[side].add(row.libero_jersey_number)
            shirts[side].add(row.libero_substitute_jersey_number)
        }
        if (row.event_type === "substitution" && shirts[side]) {
            shirts[side].add(row.substitute_in_jersey_number)
            shirts[side].add(row.substitute_out_jersey_number)
        }
    }
    for (const row of rallies) {
        const side = row.team_involved
        if (shirts[side] && row.jersey_number && !liberos[side].has(row.jersey_number)) {
            shirts[side].add(row.jersey_number)
        }
    }
    return ["home", "away"].map((side) => {
        const regular = [...shirts[side]].filter((shirt) => !liberos[side].has(shirt))
        const players = regular.map((shirt) => ({ shirt, name: "J" + shirt }))
        for (const shirt of liberos[side]) {
            players.push({ shirt, name: "Lib" + shirt, libero: true })
        }
        return { kind: "roster", side, name: side, players }
    })
}

/**
 * Reconstrucción de un partido con su contabilidad de incidencias.
 */
class LeagueMatch {
    #rules
    #report

    /**
     * @param {object} rules motor
     * @param {string} id identificador del partido
     * @param {object} report acumulador global
     */
    constructor(rules, id, report) {
        this.#rules = rules
        this.#report = report
        this.id = id
        this.settings = { substitutions: 8 }
        this.plays = []
        this.lastRallyIndex = -1
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
     * Añade una jugada si es legal; si no, la cuenta como incidencia agrupada por mensaje.
     * @param {object} play jugada
     * @param {number} set set del documento
     * @returns {boolean}
     */
    add(play, set) {
        const at = new Date(MATCH_CLOCK + this.plays.length * 17000).toISOString()
        const stamped = { ...play, at }
        const verdict = this.#rules.check(this.settings, {}, this.plays, stamped)
        if (verdict !== null) {
            const kind = play.kind + ": " + verdict.replace(/\d+/g, "N")
            this.#report.note(kind, this.id + " set " + set + " " + JSON.stringify(play))
            return false
        }
        this.plays.push(stamped)
        return true
    }
}

/**
 * Totales de toda la pasada.
 */
class Report {
    constructor() {
        this.matches = 0
        this.identical = 0
        this.points = 0
        this.serverHits = 0
        this.serverMisses = 0
        this.setsEqual = 0
        this.setsDifferent = 0
        this.incidents = new Map()
    }

    /**
     * Cuenta una incidencia y guarda un ejemplo.
     * @param {string} kind tipo
     * @param {string} example ejemplo
     */
    note(kind, example) {
        if (!this.incidents.has(kind)) {
            this.incidents.set(kind, [])
        }
        this.incidents.get(kind).push(example)
    }
}

/**
 * Empieza un set nuevo: sorteo si es el primero o el decisivo, alineaciones e inicio.
 * @param {object} rules motor
 * @param {LeagueMatch} game partido
 * @param {object} row fila que abre el set
 * @param {number} set número de set
 * @returns {boolean} si el set pudo empezar
 */
function openSet(rules, game, row, set) {
    const period = game.period()
    if (set === 1) {
        const left = row.opening_set_left_side_team
        game.add({ kind: "toss", server: row.opening_set_serving_team, left }, set)
    } else if (period.decider) {
        const left = row.deciding_set_left_side_team
        game.add({ kind: "toss", server: row.deciding_set_serving_team, left }, set)
    }
    for (const side of ["home", "away"]) {
        const prefix = side + "_team_starter_position_"
        const shirts = [1, 2, 3, 4, 5, 6].map((zone) => row[prefix + zone])
        game.add({ kind: "lineup", side, shirts }, set)
    }
    return game.add({ kind: "startPeriod" }, set)
}

/**
 * Traduce un suceso del registro y lo aplica.
 * @param {object} rules motor
 * @param {LeagueMatch} game partido
 * @param {object} row fila
 * @param {object} context {set, point, servers, report}
 */
function applyEvent(rules, game, row, context) {
    const side = row.team_involved
    const set = context.set
    if (row.event_type === "rally") {
        applyRally(rules, game, row, context)
    } else if (row.event_type === "libero") {
        applyLibero(game, row, context)
    } else if (row.event_type === "substitution") {
        const play = {
            kind: "substitution",
            side,
            leaving: row.substitute_out_jersey_number,
            entering: row.substitute_in_jersey_number,
        }
        if (row.is_exceptional === "TRUE") {
            play.exceptional = true
        }
        game.add(play, set)
    } else if (row.event_type === "timeout") {
        game.add({ kind: "timeout", side }, set)
    } else if (row.event_type === "sanction") {
        const target = staffTarget(row.staff_type)
        game.add({ kind: "sanction", side, target, level: "warning" }, set)
    } else if (row.event_type === "delay") {
        const level = game.state().delayWarned[side] ? "delayPenalty" : "delayWarning"
        game.add({ kind: "sanction", side, target: "team", level }, set)
    } else if (row.event_type === "videoChallenge") {
        applyChallenge(rules, game, row, context)
    }
}

/**
 * Destinatario de una amonestación según el tipo de oficial del registro.
 * @param {string|null} staffType tipo
 * @returns {string}
 */
function staffTarget(staffType) {
    if (staffType === "assistant") {
        return "assistant"
    }
    return staffType === "coach" ? "coach" : "team"
}

/**
 * Un rally: sin ganador es una repetición; con ganador se compara primero el sacador.
 * @param {object} rules motor
 * @param {LeagueMatch} game partido
 * @param {object} row fila
 * @param {object} context contexto del set
 */
function applyRally(rules, game, row, context) {
    if (!row.rally_point_winner) {
        game.add({ kind: "replayRally" }, context.set)
        return
    }
    context.point += 1
    const real = context.servers.get(context.set + "|" + context.point)
    if (real) {
        const period = game.period()
        const ours = { side: period.serving, shirt: rules.onCourt(period, period.serving)[0] }
        context.report.points += 1
        if (ours.side === real.side && ours.shirt === real.shirt) {
            context.report.serverHits += 1
        } else {
            context.report.serverMisses += 1
            const where = game.id + " set " + context.set + " punto " + context.point
            context.report.note("sacador distinto", where + ": real " + real.side + real.shirt
                + ", nuestro " + ours.side + ours.shirt)
        }
    }
    if (game.add({ kind: "rally", side: row.rally_point_winner }, context.set)) {
        game.lastRallyIndex = game.plays.length - 1
    }
}

/**
 * Entrada, cambio o salida del líbero.
 * @param {LeagueMatch} game partido
 * @param {object} row fila
 * @param {object} context contexto del set
 */
function applyLibero(game, row, context) {
    const side = row.team_involved
    const current = game.period().libero[side]
    if (row.libero_enters === "TRUE") {
        let leaving = row.libero_substitute_jersey_number
        if (current && current.shirt !== row.libero_jersey_number) {
            leaving = current.shirt
        }
        game.add({ kind: "liberoIn", side, libero: row.libero_jersey_number, leaving }, context.set)
        return
    }
    if (!current) {
        const where = game.id + " set " + context.set
        context.report.note("salida de líbero que el motor ya había hecho al rotar", where)
        return
    }
    game.add({ kind: "liberoOut", side }, context.set)
}

/**
 * Revisión por vídeo que corrige el último tanto: se da al otro equipo o se repite.
 * @param {object} rules motor
 * @param {LeagueMatch} game partido
 * @param {object} row fila
 * @param {object} context contexto del set
 */
function applyChallenge(rules, game, row, context) {
    if (game.lastRallyIndex !== game.plays.length - 1) {
        return
    }
    if (row.challenge_score_change === "assignToOther") {
        const undone = game.plays.pop()
        game.add({ kind: "rally", side: rules.rival(undone.side) }, context.set)
        game.lastRallyIndex = game.plays.length - 1
    } else if (row.challenge_score_change === "repeatLast") {
        game.plays.pop()
        context.point -= 1
        game.add({ kind: "replayRally" }, context.set)
    }
}

/**
 * Reconstruye un partido y lo compara con el resultado real.
 * @param {object} rules motor
 * @param {string} id partido
 * @param {object[]} events sucesos
 * @param {object[]} rallies punto a punto
 * @param {Report} report acumulador
 */
function checkMatch(rules, id, events, rallies, report) {
    report.matches += 1
    const game = new LeagueMatch(rules, id, report)
    for (const roster of inferRosters(events, rallies)) {
        game.add(roster, 0)
    }
    const context = { set: 0, point: 0, servers: realServers(rallies), report }
    for (const row of events) {
        const set = Number(row.set)
        if (set !== context.set) {
            context.set = set
            context.point = 0
            if (!openSet(rules, game, row, set)) {
                report.note("partido sin reproducir", id)
                return
            }
        }
        applyEvent(rules, game, row, context)
    }
    const match = game.state()
    const finals = new Map()
    for (const row of events) {
        const home = Number(row.set_final_home_score)
        finals.set(Number(row.set), { home, away: Number(row.set_final_away_score) })
    }
    let same = true
    for (const [number, real] of finals) {
        const period = match.periods.find((entry) => entry.number === number)
        if (period && period.score.home === real.home && period.score.away === real.away) {
            report.setsEqual += 1
            continue
        }
        report.setsDifferent += 1
        same = false
        const ours = period ? period.score.home + "-" + period.score.away : "—"
        const expected = real.home + "-" + real.away
        report.note("marcador de set distinto", id + " set " + number + ": real " + expected
            + ", nuestro " + ours)
    }
    if (match.phase !== "over") {
        report.note("el partido no acaba en el motor", id + ": fase " + match.phase)
        return
    }
    if (same) {
        report.identical += 1
    }
}

/**
 * Carpeta con los CSV: la indicada o una temporal fija; descarga lo que falte.
 * @param {string|null} folder carpeta pedida
 * @returns {Promise<string>}
 */
async function dataFolder(folder) {
    const target = folder ?? join(tmpdir(), "empat-oraculos")
    mkdirSync(target, { recursive: true })
    for (const [file, url] of Object.values(SOURCES)) {
        const path = join(target, file)
        if (!existsSync(path)) {
            const response = await fetch(url)
            if (!response.ok) {
                throw new Error("no se ha podido descargar " + file + " (" + response.status + ")")
            }
            writeFileSync(path, Buffer.from(await response.arrayBuffer()))
        }
    }
    return target
}

/**
 * Lee las opciones de la línea de órdenes.
 * @param {string[]} args argumentos
 * @returns {{data: string|null, minimum: number, detail: boolean}}
 */
function readOptions(args) {
    const valueOf = (flag) => {
        const index = args.indexOf(flag)
        return index >= 0 ? args[index + 1] : undefined
    }
    const minimum = Number(valueOf("--minimum"))
    return {
        data: valueOf("--data") ?? valueOf("--cache") ?? null,
        minimum: Number.isFinite(minimum) ? minimum : DEFAULT_MINIMUM,
        detail: args.includes("--detail"),
    }
}

/**
 * Imprime el informe.
 * @param {Report} report totales
 * @param {boolean} detail si se listan los ejemplos
 */
function printReport(report, detail) {
    const share = (100 * report.serverHits / Math.max(1, report.points)).toFixed(2)
    console.log("Partidos: " + report.matches
        + " · idénticos de principio a fin: " + report.identical)
    console.log("Sacador: " + report.serverHits + " de " + report.points
        + " puntos iguales (" + share + " %) · distintos: " + report.serverMisses)
    console.log("Sets con el mismo marcador: " + report.setsEqual
        + " · distintos: " + report.setsDifferent)
    const ordered = [...report.incidents].sort((left, right) => right[1].length - left[1].length)
    console.log("\nIncidencias (" + ordered.length + " tipos):")
    for (const [kind, examples] of ordered) {
        console.log("  " + examples.length + "× " + kind)
        if (detail) {
            for (const example of examples) {
                console.log("       · " + example.slice(0, 220))
            }
        }
    }
}

/**
 * Punto de entrada de la línea de órdenes.
 * @param {string[]} args argumentos
 * @returns {Promise<number>} código de salida
 */
export async function runLeagueCsv(args) {
    const options = readOptions(args)
    const folder = await dataFolder(options.data)
    const events = byMatch(parseCsv(readFileSync(join(folder, SOURCES.events[0]), "utf8")))
    const rallies = byMatch(parseCsv(readFileSync(join(folder, SOURCES.rallies[0]), "utf8")))
    const rules = await loadRules()
    const report = new Report()
    for (const [id, rows] of events) {
        checkMatch(rules, id, rows, rallies.get(id) ?? [], report)
    }
    printReport(report, options.detail)
    const counted = report.identical + " partidos idénticos"
    if (report.identical >= options.minimum) {
        console.log("\nOK: " + counted + " (mínimo " + options.minimum + ").")
        return 0
    }
    console.log("\nFALLA: " + counted + "; se pedían " + options.minimum + ".")
    return 1
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    process.exitCode = await runLeagueCsv(process.argv.slice(2))
}
