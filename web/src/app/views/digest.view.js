/**
 * Resumen propio del acta, la alternativa al acta oficial en la vista de impresión. Función
 * pura: recibe un modelo y devuelve marcado; no lee estado global.
 *
 * Es una sucesión de tablas sencillas: datos del encuentro, plantillas, árbitros, sorteos, un
 * bloque por set, sanciones, resultados, set obligatorio, observaciones, correcciones y firmas.
 * El equipo A es el que empezó el primer set a la izquierda del anotador. Los saltos de línea y
 * las sangrías de las plantillas forman nodos de texto que se comparan con la referencia.
 * @module src/app/views/digest.view.js
 */

import { html, raw } from "../dom.js"
import { clockTime } from "../format.js"
import {
    CLOSING_SIGNERS,
    OPENING_SIGNERS,
    SANCTION_LABELS,
    SIGNER_LABELS,
    ZONE_NUMERALS,
} from "../constants.js"
import { teamLabel } from "./common.view.js"
import { byShirtKey, sealStamp } from "./final.view.js"

/**
 * Sigla de cada cargo del cuerpo técnico tal como se escribe en el resumen. Es la notación de
 * la plantilla (E, E2…), distinta de la del acta oficial (E, 2E…).
 */
const ROLE_SIGLA = Object.freeze({
    coach: "E",
    assistant: "E2",
    assistant2: "E3",
    physio: "F",
    doctor: "M",
    psychologist: "PS",
    fitness: "PF",
    masseur: "MS",
})

/**
 * Salto de línea dentro de una celda.
 */
const BREAK = raw("<br>")

/**
 * Celda alineada a la izquierda, para textos largos.
 */
const LEFT = raw("class=\"digest-left\"")

/**
 * Pie del resumen: aclara que no sustituye al acta oficial.
 * @param {string} stamp fecha y hora de generación
 * @returns {string}
 */
function footerText(stamp) {
    return `Resumen generado con emPat el ${stamp}. No es un documento oficial.`
}

/**
 * Marcador relativo "propio:rival" de una anotación.
 * @param {{own: number, rival: number}} entry anotación
 * @returns {string}
 */
function relative(entry) {
    return `${entry.own}:${entry.rival}`
}

/**
 * Marcador absoluto "local:visitante" de una anotación.
 * @param {{home: number, away: number}} entry anotación
 * @returns {string}
 */
function absolute(entry) {
    return `${entry.home}:${entry.away}`
}

/**
 * Une trozos de marcado con un separador, que también es marcado.
 * @param {Array<Markup|string>} parts trozos
 * @param {Markup|string} glue separador
 * @returns {Array<Markup|string>}
 */
function interleave(parts, glue) {
    const out = []
    for (const [index, part] of parts.entries()) {
        if (index > 0) {
            out.push(glue)
        }
        out.push(part)
    }
    return out
}

/**
 * Herramientas comunes de todas las tablas: letra A/B, nombre de equipo y objetivo del set.
 * @param {object} model modelo de la vista
 * @returns {{letter: Function, name: Function, sideA: string, sideB: string}}
 */
function lettering({ info, match }) {
    const sideA = match.periods[0].leftSide || "home"
    const sideB = sideA === "home" ? "away" : "home"
    return {
        sideA,
        sideB,
        letter: (side) => (side === sideA ? "A" : "B"),
        name: (side) => teamLabel(info, side),
    }
}

/**
 * Fila de un jugador en la plantilla.
 * @param {object} player jugador
 * @returns {Markup}
 */
function playerRow(player) {
    const category = player.category ? ` (${player.category})` : ""
    const libero = player.libero ? " (L)" : ""
    const marks = (player.captain ? "C" : "") + (player.libero ? "L" : "")
    const label = (player.name ?? "") + category + libero
    return html`<tr><td>${player.shirt}</td><td ${LEFT}>${label}</td><td>${marks}</td></tr>`
}

/**
 * Fila de un miembro del cuerpo técnico en la plantilla.
 * @param {object} member miembro
 * @param {object} titles cargo visible de cada rol
 * @returns {Markup}
 */
function staffRow(member, titles) {
    const title = titles[member.role] || member.role
    const sigla = ROLE_SIGLA[member.role] ?? member.role
    const tail = html`<span style="color:#666">· ${title}</span>`
    return html`<tr><td>${sigla}</td><td ${LEFT} colspan="2">${member.name} ${tail}</td></tr>`
}

/**
 * Plantilla de un equipo: jugadores y cuerpo técnico con nombre.
 * @param {object} model modelo de la vista
 * @param {object} tools letras y nombres
 * @param {"home"|"away"} side lado
 * @returns {Markup}
 */
function rosterTable({ match, titles }, tools, side) {
    const team = match.teams[side]
    const staff = team.staff.filter((member) => member.name)
    const head = html`<tr><th colspan="3">${tools.letter(side)} · ${tools.name(side)}</th></tr>`
    return html`<table>${head}<tr><th>Nº</th><th>Jugador</th><th></th></tr>
      ${team.players.map(playerRow)}
      ${staff.map((member) => staffRow(member, titles))}</table>`
}

/**
 * Sustituciones que tocan la columna de una posición: las del titular y las de su pareja.
 * @param {object} period set
 * @param {"home"|"away"} side lado
 * @param {string|undefined} starter titular de esa posición
 * @returns {object[]}
 */
function columnSubstitutions(period, side, starter) {
    const partner = period.partners[side][starter]
    return period.substitutions[side].filter((entry) => entry.leaving === starter
        || entry.entering === starter
        || partner === entry.leaving
        || partner === entry.entering)
}

/**
 * Casillas de puntos de un equipo en un set: tantas como el objetivo o los puntos hechos, con
 * las marcadas tachadas y las de castigo rodeadas.
 * @param {object} period set
 * @param {"home"|"away"} side lado
 * @param {number} target puntos del set
 * @returns {Array<Markup|string>}
 */
function pointBoxes(period, side, target) {
    const scored = period.rallyLog.filter((entry) => entry.side === side && !entry.voided)
    const total = Math.max(period.score[side], target)
    const boxes = []
    for (let index = 0; index < total; index += 1) {
        const entry = scored[index]
        let classes = "digest-pt"
        if (entry) {
            classes += " digest-pt--void"
            if (entry.cause !== "play") {
                classes += " digest-pt--ring"
            }
        }
        boxes.push(html`<span class="${classes}">${index + 1}</span>`)
    }
    return interleave(boxes, " ")
}

/**
 * Celdas de una fila de seis, una por posición.
 * @param {Array<Markup|string>} values contenido de cada celda
 * @returns {Markup[]}
 */
function sixCells(values) {
    return values.map((value) => html`<td>${value}</td>`)
}

/**
 * Tabla de un equipo dentro del bloque de un set.
 * @param {object} model modelo de la vista
 * @param {object} tools letras y nombres
 * @param {object} period set
 * @param {"home"|"away"} side lado
 * @returns {Markup}
 */
function periodSide({ match }, tools, period, side) {
    const lineup = period.lineup[side] || []
    const subs = []
    const serves = []
    for (let column = 0; column < ZONE_NUMERALS.length; column += 1) {
        const entries = columnSubstitutions(period, side, lineup[column])
        subs.push(interleave(entries.map((entry) => html`${entry.entering}${BREAK}${
            relative(entry)}`), BREAK))
        const turns = period.turns[side].filter((turn) => turn.column === column)
        serves.push(turns.map((turn) => turn.until ?? "·").join(" "))
    }
    const target = match.targetOf(period)
    const timeouts = period.timeouts[side].map(relative).join(" · ") || "—"
    const swaps = period.liberoSwaps[side].map((entry) => `${entry.entering}↔${entry.leaving} ${
        relative(entry)}`).join(" · ") || "—"
    const role = period.firstServer === side ? "(saca)" : "(recibe)"
    const wide = raw("colspan=\"6\" class=\"digest-left\"")
    return html`<table><tr><th colspan="7">${tools.letter(side)} · ${tools.name(side)} ${
        role}</th></tr>
        <tr><th></th>${ZONE_NUMERALS.map((zone) => html`<th>${zone}</th>`)}</tr>
        <tr><th>Titular</th>${lineup.map((shirt) => html`<td><b>${shirt}</b></td>`)}</tr>
        <tr><th>Sustituciones</th>${sixCells(subs)}</tr>
        <tr><th>Saque</th>${sixCells(serves)}</tr>
        <tr><th>Tiempos de descanso</th><td ${wide}>${timeouts}</td></tr>
        <tr><th>Líbero</th><td ${wide}>${swaps}</td></tr>
        <tr><th>Puntos</th><td ${wide}>${pointBoxes(period, side, target)}</td></tr></table>`
}

/**
 * Bloque de un set empezado: cabecera con horas y resultado y las tablas de los dos equipos.
 * @param {object} model modelo de la vista
 * @param {object} tools letras y nombres
 * @param {object} period set
 * @returns {Markup|string}
 */
function periodBlock(model, tools, period) {
    if (!period.startedAt) {
        return ""
    }
    let title = "Golden set"
    if (!period.isGolden) {
        title = `Set ${period.number}` + (period.decider ? " (decisivo)" : "")
    }
    const swap = period.switched
        ? " · cambio de campo a los " + model.match.settings.deciderSwitch
        : ""
    const head = `${title} · inicio ${clockTime(period.startedAt)} · fin ${
        clockTime(period.endedAt)} · ${period.score.home}-${period.score.away} ${
        tools.name("home") ?? ""}–${tools.name("away") ?? ""}${swap}`
    return html`<div class="digest-block"><table><tr><th ${LEFT}>${head}</th></tr></table>
      <div class="digest-cols">${periodSide(model, tools, period, tools.sideA)}${
    periodSide(model, tools, period, tools.sideB)}</div></div>`
}

/**
 * A quién va una sanción, como se escribe en la tabla: el dorsal, "Equipo" o la sigla del
 * cargo.
 * @param {unknown} target destinatario
 * @param {Function} isShirt reconocedor de dorsales del motor
 * @returns {unknown}
 */
function sanctionTarget(target, isShirt) {
    if (isShirt(target)) {
        return target
    }
    if (target === "team") {
        return "Equipo"
    }
    return ROLE_SIGLA[target] ?? target
}

/**
 * Tabla de sanciones del partido.
 * @param {object} model modelo de la vista
 * @param {object} tools letras y nombres
 * @returns {Markup}
 */
function sanctionsBlock({ match, isShirt }, tools) {
    const rows = match.sanctions.map((entry) => sanctionRow(entry, tools, isShirt))
    const empty = html`<tr><td colspan="6">—</td></tr>`
    const heads = ["Tipo", "Equipo", "Quién", "Set", "Marcador", "Hora"]
    const title = html`<tr><th colspan="7">Sanciones</th></tr>`
    return html`<div class="digest-block"><table>${title}<tr>${heads.map(headCell)}</tr>
      ${rows.length > 0 ? rows : empty}</table></div>`
}

/**
 * Fila de una sanción: nivel, letra del equipo, destinatario, set, marcador y hora.
 * @param {object} entry sanción del partido
 * @param {object} tools letras y nombres
 * @param {Function} isShirt reconocedor de dorsales del motor
 * @returns {Markup}
 */
function sanctionRow(entry, tools, isShirt) {
    const cells = [
        SANCTION_LABELS[entry.level],
        tools.letter(entry.side),
        sanctionTarget(entry.target, isShirt),
        entry.period,
        relative(entry),
        clockTime(entry.at),
    ]
    return html`<tr>${cells.map((value) => html`<td>${value}</td>`)}</tr>`
}

/**
 * Celda de cabecera.
 * @param {string} text rótulo
 * @returns {Markup}
 */
function headCell(text) {
    return html`<th>${text}</th>`
}

/**
 * Celdas de un equipo en la tabla de resultados, en el orden de su lado del papel.
 * @param {object} counts tiempos, sustituciones, sets y puntos
 * @param {boolean} mirrored si va a la derecha (puntos primero)
 * @returns {Markup}
 */
function countCells(counts, mirrored) {
    const values = [counts.timeouts, counts.substitutions, counts.won, counts.points]
    if (mirrored) {
        values.reverse()
    }
    return html`${values.map((value) => html`<td>${value}</td>`)}`
}

/**
 * Tabla de resultados por set, totales, horas y ganador.
 * @param {object} model modelo de la vista
 * @param {object} tools letras y nombres
 * @returns {Markup}
 */
function resultsBlock({ summary }, tools) {
    const { sideA, sideB } = tools
    const heads = ["Set", "Min.", "A T", "A S", "A G", "A P", "B P", "B G", "B S", "B T"]
    const rows = summary.rows.map((row) => html`<tr><td>${row.period}</td><td>${
        row.minutes ?? ""}</td>${countCells(row[sideA], false)}${
        countCells(row[sideB], true)}</tr>`)
    const totals = summary.totals
    const total = html`<tr><th>Total</th><td>${totals.minutes}</td>${
        countCells(totals[sideA], false)}${countCells(totals[sideB], true)}</tr>`
    return html`<div class="digest-block"><table><tr>${heads.map(headCell)}</tr>
      ${rows}
      ${total}</table>
      <table>${timesRow(summary, tools)}
      ${goldenRow(summary.golden, tools)}</table></div>`
}

/**
 * Fila con la hora de inicio y de fin, la duración y el ganador con su resultado.
 * @param {object} summary resumen del partido
 * @param {object} tools letras y nombres
 * @returns {Markup}
 */
function timesRow(summary, tools) {
    const totals = summary.totals
    const high = Math.max(totals.home.won, totals.away.won)
    const low = Math.min(totals.home.won, totals.away.won)
    const winner = summary.winner ? `${tools.name(summary.winner) ?? ""} ${high}:${low}` : ""
    const start = html`<th>Inicio</th><td>${clockTime(summary.startedAt)}</td>`
    const end = html`<th>Fin</th><td>${clockTime(summary.endedAt)}</td>`
    const span = html`<th>Duración</th><td>${summary.matchMinutes ?? ""} min</td>`
    return html`<tr>${start}${end}${span}<th>Ganador</th><td>${winner}</td></tr>`
}

/**
 * Fila del golden set bajo los resultados, si se ha jugado.
 * @param {object|null} golden resumen del golden set
 * @param {object} tools letras y nombres
 * @returns {Markup|string}
 */
function goldenRow(golden, tools) {
    if (!golden) {
        return ""
    }
    const winner = golden.winner ? `ganador: ${tools.name(golden.winner) ?? ""} · ` : ""
    const length = golden.minutes !== null && golden.minutes !== undefined
        ? ` · ${golden.minutes} min`
        : ""
    const score = `${tools.name("home") ?? ""} ${golden.points.home}:${golden.points.away} ${
        tools.name("away") ?? ""}`
    return html`<tr><th>Golden set</th><td colspan="7" class="digest-left">${
        winner + score + length}</td></tr>`
}

/**
 * Tabla del set obligatorio de un equipo en el resumen: X si jugó el set entero y * si se
 * corrigió a mano.
 * @param {object} tools letras y nombres
 * @param {"home"|"away"} side lado
 * @param {object[]} lines líneas del informe, ya ordenadas
 * @param {number[]} numbers sets empezados
 * @returns {Markup}
 */
function fullSetSide(tools, side, lines, numbers) {
    const heads = numbers.map((number) => html`<th>S${number}</th>`)
    const rows = lines.map((line) => html`<tr><td>${line.shirt}</td><td class="digest-left">${
        line.name}</td>${line.periods.map((entry) => html`<td>${entry.complete ? "X" : ""}${
        entry.manual !== null ? "*" : ""}</td>`)}<td>${
        line.ok ? "Sí" : html`<b>NO</b>`}</td></tr>`)
    return html`<table><tr><th colspan="${numbers.length + 3}">Set completo obligatorio · ${
        tools.letter(side)} · ${tools.name(side)}</th></tr><tr><th>Nº</th><th>Jugador</th>${
        heads}<th>Cumple</th></tr>${rows}</table>`
}

/**
 * Bloque del set obligatorio, solo en las categorías que lo exigen.
 * @param {object} model modelo de la vista
 * @param {object} tools letras y nombres
 * @returns {Markup|string}
 */
function fullSetBlock({ report, numbers }, tools) {
    if (!report) {
        return ""
    }
    const left = fullSetSide(tools, tools.sideA, byShirtKey(report[tools.sideA]), numbers)
    const right = fullSetSide(tools, tools.sideB, byShirtKey(report[tools.sideB]), numbers)
    const legend = "X: set entero como titular sin ser sustituido · *: corrección manual del anotador."
    return html`<div class="digest-block digest-cols"><div>${left}</div><div>${
        right}</div></div><p style="font-size:9px;margin:-4px 0 6px">${legend}</p>`
}

/**
 * Nombre del equipo tal como lo guardó su plantilla, o el de los datos si no lo tiene.
 * @param {object} match partido
 * @param {object} tools letras y nombres
 * @param {"home"|"away"} side lado
 * @returns {string}
 */
function rosterName(match, tools, side) {
    return match.teams[side].name || (tools.name(side) ?? "")
}

/**
 * Frase del fin anticipado del partido.
 * @param {object} match partido
 * @param {object} tools letras y nombres
 * @returns {string[]}
 */
function forfeitLines(match, tools) {
    const forfeit = match.forfeit
    if (!forfeit) {
        return []
    }
    const team = rosterName(match, tools, forfeit.side)
    if (forfeit.reason === "noShow") {
        return [`Incomparecencia de ${team}: partido 0-3 con todos los sets 0-25.`]
    }
    return [`Set ${forfeit.period} ${clockTime(forfeit.at)}: equipo incompleto de ${team} (${
        absolute(forfeit)}); los puntos y sets que faltan son para el rival.`]
}

/**
 * Observaciones del resumen, en el orden del papel: repeticiones, cadetes, delegados, faltas
 * de rotación, fin anticipado, líberos impedidos, capitanes en juego y notas del anotador.
 * @param {object} model modelo de la vista
 * @param {object} tools letras y nombres
 * @returns {string[]}
 */
function remarkLines({ match, info }, tools) {
    const lines = []
    for (const period of match.periods) {
        for (const entry of period.replays) {
            lines.push(`Set ${period.number} ${clockTime(entry.at)}: se repite la jugada (${
                absolute(entry)}).`)
        }
    }
    for (const side of ["home", "away"]) {
        const cadets = match.teams[side].players.filter((player) => player.category === "C")
        if (cadets.length > 0) {
            const shirts = cadets.map((player) => player.shirt).join(", ")
            lines.push(`Jugadores cadetes inscritos por ${tools.name(side) ?? ""}: ${shirts}.`)
        }
    }
    for (const side of ["home", "away"]) {
        const delegate = info[side + "Delegate"]
        if (delegate) {
            lines.push(`Delegado/a de ${tools.name(side) ?? ""}: ${delegate}.`)
        }
    }
    for (const fault of match.rotationFaults) {
        const voided = fault.voided
            ? `; se le anulan ${fault.voided} puntos desde que la cometió`
            : ""
        lines.push(`Set ${fault.period} ${clockTime(fault.at)}: ${
            rosterName(match, tools, fault.side)} comete falta de rotación (${
            relative(fault)}); punto para el rival${voided}.`)
    }
    lines.push(...forfeitLines(match, tools))
    for (const side of ["home", "away"]) {
        for (const loss of match.liberoLosses[side]) {
            const successor = loss.successor
                ? `; nuevo líbero re-designado, el ${loss.successor}`
                : ""
            lines.push(`Set ${loss.period} ${clockTime(loss.at)}: ${
                tools.name(side) ?? ""}, líbero ${loss.libero} incapacitado para jugar${
                successor} (${relative(loss)}).`)
        }
    }
    for (const entry of match.actingCaptains) {
        lines.push(`Set ${entry.period} ${clockTime(entry.at)}: ${
            tools.name(entry.side) ?? ""} designa capitán en juego al ${entry.shirt} (${
            relative(entry)}).`)
    }
    for (const note of match.notes) {
        lines.push(`Set ${note.period} ${clockTime(note.at)}: ${note.text}`)
    }
    return lines
}

/**
 * Celda con varias líneas separadas por saltos, o una raya si no hay ninguna.
 * @param {string[]} lines líneas de texto
 * @returns {Array<Markup|string>|string}
 */
function stackedLines(lines) {
    if (lines.length === 0) {
        return "—"
    }
    return interleave(lines, BREAK)
}

/**
 * Bloque de correcciones del anotador, si las hay.
 * @param {object[]} amendments correcciones
 * @returns {Markup|string}
 */
function amendmentsBlock(amendments) {
    if (amendments.length === 0) {
        return ""
    }
    const lines = amendments.map((entry) => `${clockTime(entry.at)} · set ${entry.period} (${
        absolute(entry)}): ${entry.text}`)
    const title = "Correcciones del acta (acciones deshechas en el partido)"
    return html`<div class="digest-block"><table><tr><th ${LEFT}>${title}</th></tr><tr><td ${
        LEFT}>${interleave(lines, BREAK)}</td></tr></table></div>`
}

/**
 * Celda de una firma: rótulo e imagen con el nombre si ya está firmada.
 * @param {object} signatures firmas del partido
 * @param {string} slot casilla
 * @param {string} title rótulo
 * @returns {Markup}
 */
function signatureCell(signatures, slot, title) {
    const signature = signatures[slot]
    const body = signature
        ? html`<img src="${signature.image}" alt=""><br>${signature.signer}`
        : ""
    return html`<td><b>${title}</b><br>${body}</td>`
}

/**
 * Bloque de firmas: las previas en la primera fila y las del cierre en la segunda.
 * @param {object} signatures firmas del partido
 * @returns {Markup}
 */
function signaturesBlock(signatures) {
    const before = OPENING_SIGNERS.map((slot) => signatureCell(signatures, slot,
        SIGNER_LABELS[slot] + " (previa)"))
    const after = CLOSING_SIGNERS.map((slot) => signatureCell(signatures, slot,
        SIGNER_LABELS[slot]))
    return html`<div class="digest-block"><table><tr>${before}</tr><tr>${after}</tr></table></div>`
}

/**
 * Cabecera con los datos del encuentro y el estado de aprobación.
 * @param {object} model modelo de la vista
 * @returns {Markup}
 */
function infoTable({ info, match, sealed }) {
    const state = sealed
        ? `Aprobada el ${sealStamp(sealed.at)} por anotador, capitanes y 1er árbitro`
        : "Pendiente de aprobación"
    const first = [
        html`<th>Competición</th><td ${LEFT}>${info.competition}</td>`,
        html`<th>Categoría</th><td>${info.category}</td>`,
        html`<th>Partido</th><td>${info.matchNo}</td>`,
        html`<th>Fecha</th><td>${info.date}</td>`,
        html`<th>Hora</th><td>${info.time}</td>`,
    ]
    const second = [
        html`<th>Pabellón</th><td ${LEFT} colspan="3">${info.venue}</td>`,
        html`<th>Población</th><td colspan="3">${info.town}</td>`,
        html`<th>Formato</th><td>Al mejor de ${match.settings.bestOf}</td>`,
    ]
    const third = [
        html`<th>Espectadores</th><td>${info.attendance ?? ""}</td>`,
        html`<th>Estado</th><td ${LEFT} colspan="7">${state}</td>`,
    ]
    return html`<table><tr>${first}</tr>
      <tr>${second}</tr>
      <tr>${third}</tr></table>`
}

/**
 * Tabla de árbitros y anotadores.
 * @param {object} info datos del encuentro
 * @returns {Markup}
 */
function officialsTable(info) {
    const judges = [info.lineJudge1, info.lineJudge2].filter(Boolean).join(", ")
    return html`<table><tr><th>1er árbitro</th><td>${info.referee1}</td><th>2º árbitro</th><td>${
        info.referee2}</td><th>Anotador</th><td>${info.scorer}</td><th>Anot. asistente</th><td>${
        info.assistantScorer}</td><th>Jueces de línea</th><td>${judges}</td></tr></table>`
}

/**
 * Tabla de sorteos: quién sacó y quién empezó a la izquierda en cada set sorteado.
 * @param {object} match partido
 * @param {object} tools letras y nombres
 * @returns {Markup}
 */
function tossTable(match, tools) {
    const text = match.tosses.map((toss) => `Set ${toss.period}: saque de ${
        tools.name(toss.server) ?? ""}; izquierda, ${tools.name(toss.left) ?? ""}`).join(" · ")
    return html`<table><tr><th>Sorteos</th><td class="digest-left">${text}</td></tr></table>`
}

/**
 * Resumen completo del acta para ver e imprimir.
 * @param {{info: object, match: object, summary: object, report: object|null,
 *     numbers: number[], amendments: object[], sealed: object|undefined,
 *     titles: object, isShirt: Function, generatedAt: string}} model datos del encuentro,
 *     partido, resumen, informe de set completo (o null si no se exige), sets empezados,
 *     correcciones, aprobación, cargos visibles, reconocedor de dorsales y fecha de generación
 * @returns {Markup} marcado HTML
 */
export function digestSheet(model) {
    const { info, match } = model
    const tools = lettering(model)
    const title = `Resumen del partido · ${info.homeName ?? ""} – ${info.awayName ?? ""}`
    const remarks = stackedLines(remarkLines(model, tools))
    return html`<h1>${title}</h1>
    ${infoTable(model)}
    <div class="digest-cols"><div>${rosterTable(model, tools, tools.sideA)}</div><div>${
    rosterTable(model, tools, tools.sideB)}</div></div>
    ${officialsTable(info)}
    ${tossTable(match, tools)}
    ${match.periods.map((period) => periodBlock(model, tools, period))}
    ${sanctionsBlock(model, tools)}
    ${resultsBlock(model, tools)}
    ${fullSetBlock(model, tools)}
    <div class="digest-block"><table><tr><th ${LEFT}>Observaciones</th></tr><tr><td ${
    LEFT}>${remarks}</td></tr></table></div>
    ${amendmentsBlock(model.amendments)}
    ${signaturesBlock(match.signatures)}
    <p style="font-size:9px">${footerText(model.generatedAt)}</p>`
}
