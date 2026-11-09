/**
 * Observaciones de la hoja principal. Junta las frases que el acta genera sola (en catalán,
 * con la redacción de las circulares de la federación) con las que escribe el anotador y las
 * reparte en los cuatro renglones del impreso; lo que no cabe pasa a la hoja anexa.
 * @module src/sheet/remarks.js
 */

import { FOOTER_GRID } from "./layout.js"
import { wrapWords } from "./metrics.js"
import { isShirtLike, sheetSanctions, targetOnSheet } from "./footer.js"

/**
 * Nombre de cada nivel de sanción en las observaciones.
 */
const LEVEL_WORDING = {
    warning: "amonestació",
    penalty: "càstig",
    expulsion: "expulsió",
    disqualification: "desqualificació",
    delayWarning: "amonestació per demora",
    delayPenalty: "càstig per demora",
}

/**
 * Oficiales que, inscritos, se anuncian en observaciones (Circular 004), con su nombre.
 */
const EXTRA_STAFF = {
    psychologist: "psicòleg/oga",
    fitness: "preparador/a físic/a",
    masseur: "massatgista",
}

/**
 * Frases sobre la inscripción de un equipo: delegado, cadetes, oficiales adicionales y el
 * médico cuando la casilla T/M ya la ocupa el fisioterapeuta.
 * @param {object} context contexto de la hoja
 * @param {"home"|"away"} side equipo
 * @returns {string[]}
 */
function enrolmentRemarks(context, side) {
    const { info, match } = context
    const team = match.teams[side]
    let typed = info.awayName
    let delegate = info.awayDelegate
    if (side === "home") {
        typed = info.homeName
        delegate = info.homeDelegate
    }
    const name = typed || team.name || ""
    const lines = []
    if (delegate) {
        lines.push(`L'equip ${name} presenta delegat/da ${delegate}.`)
    }
    const cadets = team.players.filter((player) => player.category === "C")
    if (cadets.length > 0) {
        const shirts = cadets.map((player) => player.shirt).join(", ")
        lines.push(`L'equip ${name} inscriu jugadors/es cadets: ${shirts}.`)
    }
    const withName = (role) => team.staff.find((member) => member.role === role && member.name)
    for (const [role, title] of Object.entries(EXTRA_STAFF)) {
        const member = withName(role)
        if (member) {
            lines.push(`L'equip ${name} inscriu ${title}: ${member.name}.`)
        }
    }
    const doctor = withName("doctor")
    if (withName("physio") && doctor) {
        lines.push(`L'equip ${name} inscriu metge/essa: ${doctor.name}.`)
    }
    return lines
}

/**
 * Todas las observaciones en orden: inscripciones, sustituciones excepcionales, líberos
 * incapacitados, equipo incompleto o no presentado, sanciones que no caben en su cuadro y,
 * al final, lo escrito por el anotador.
 * @param {object} context contexto de la hoja
 * @returns {string[]}
 */
export function remarkLines(context) {
    const match = context.match
    const teamName = (side) => match.teams[side].name || ""
    const lines = [...enrolmentRemarks(context, "home"), ...enrolmentRemarks(context, "away")]
    for (const period of match.periods) {
        for (const side of ["home", "away"]) {
            for (const change of period.substitutions[side]) {
                if (!change.exceptional) {
                    continue
                }
                const who = `de l'equip ${teamName(side)}`
                const swap = `surt el ${change.leaving} i entra el ${change.entering}`
                const score = `(${change.own}:${change.rival})`
                const heading = `Set ${period.number}: substitució excepcional`
                lines.push(`${heading} ${who}, ${swap} ${score}.`)
            }
        }
    }
    for (const side of ["home", "away"]) {
        for (const loss of match.liberoLosses[side]) {
            const when = `al set ${loss.period} (${loss.own}:${loss.rival})`
            const team = teamName(side)
            if (loss.successor) {
                const named = `redesigna com a lliure el núm. ${loss.successor} ${when}`
                lines.push(`L'equip ${team} ${named} per la incapacitat del lliure ${loss.libero}.`)
            } else {
                const unfit = `és declarat incapaç de jugar ${when}`
                lines.push(`El lliure ${loss.libero} de l'equip ${team} ${unfit}.`)
            }
        }
    }
    const forfeit = match.forfeit
    if (forfeit && forfeit.reason === "noShow") {
        lines.push(`No presentació de l'equip ${teamName(forfeit.side)}.`)
    } else if (forfeit) {
        const score = `(${forfeit.home}:${forfeit.away})`
        const team = teamName(forfeit.side)
        lines.push(`L'equip ${team} queda incomplet al set ${forfeit.period} ${score}.`)
    }
    const overflow = sheetSanctions(match).slice(FOOTER_GRID.sanctions.count)
    for (const entry of overflow) {
        let who = targetOnSheet(entry.target)
        if (isShirtLike(entry.target)) {
            who = "el " + entry.target
        }
        const level = LEVEL_WORDING[entry.level]
        const at = `set ${entry.period} (${entry.own}:${entry.rival})`
        lines.push(`Sanció (${level}) a ${who} de l'equip ${teamName(entry.side)}, ${at}.`)
    }
    for (const note of match.notes) {
        lines.push(note.text)
    }
    return lines
}

/**
 * Escribe las observaciones en sus renglones. Cada una acaba en punto y doble barra
 * invertida, como se separan a mano, y todo va en mayúsculas. Si sobra sitio se cierra; si
 * falta, se avisa de que continúa en la hoja anexa.
 * @param {import("./canvas.js").SheetCanvas} canvas lienzo
 * @param {object} context contexto de la hoja
 * @returns {string} lo que no ha cabido (vacío si cabe todo)
 */
export function drawRemarks(canvas, context) {
    const grid = FOOTER_GRID.remarks
    const size = grid.size
    const sentences = []
    for (const line of remarkLines(context)) {
        const text = String(line).trim()
        if (!text) {
            continue
        }
        let stop = "."
        if (/[.!?]$/.test(text)) {
            stop = ""
        }
        sentences.push(`${text}${stop}\\\\`)
    }
    let pending = sentences.join(" ").toUpperCase()
    const written = []
    for (let row = 0; row < grid.rows.length && pending; row++) {
        let width = grid.rows[row][2]
        // El último renglón deja sitio para el aviso de continuación.
        if (row === grid.rows.length - 1) {
            width -= grid.reserve
        }
        const piece = wrapWords(pending, width, size)[0] || ""
        written.push(piece)
        pending = pending.slice(pending.indexOf(piece) + piece.length).trim()
    }
    for (const [row, piece] of written.entries()) {
        const [x, base, width] = grid.rows[row]
        canvas.baseline(x, base, width, piece, { size })
    }
    if (pending) {
        canvas.baseline(...grid.overflow, "Continua al full annex", { size: 6.5, bold: true })
        return pending
    }
    const guides = grid.rows.map(([x, base, width]) => [x, base - 0.56, x + width - 0.7])
    canvas.tailRows(guides, written, size, grid.end)
    return pending
}
