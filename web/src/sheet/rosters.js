/**
 * Inscripción de los dos equipos: jugadores por dorsal, capitán rodeado, marcas de categoría y
 * de líbero, y los oficiales del banquillo.
 * @module src/sheet/rosters.js
 */

import { surnameFirst, rosterSurnames } from "./names.js"

/**
 * Orden de la inscripción: el 00 delante y después por número.
 * @param {{shirt: string}} player jugador
 * @returns {number}
 */
function shirtRank(player) {
    if (player.shirt === "00") {
        return -1
    }
    return Number(player.shirt)
}

/**
 * Marcas que siguen al nombre: categoría entre paréntesis y (L) para el líbero.
 * @param {object} player jugador
 * @returns {string} con un espacio delante de cada marca, o vacío
 */
function markSuffix(player) {
    let marks = ""
    if (player.category) {
        marks += ` (${player.category})`
    }
    if (player.libero) {
        marks += " (L)"
    }
    return marks
}

/**
 * Nombre del primer oficial con ese cargo que lo tenga escrito.
 * @param {object[]} staff oficiales
 * @param {string} role cargo
 * @returns {string}
 */
function staffName(staff, role) {
    const found = staff.find((member) => member.role === role && member.name)
    return found?.name || ""
}

/**
 * Renglones de oficiales. El estándar tiene uno por entrenador y otro para
 * fisioterapeuta/médico; el infantil junta los asistentes en un solo renglón.
 * @param {object[]} staff oficiales
 * @param {number} rowCount renglones del impreso (3 o 4)
 * @returns {string[]}
 */
function staffLines(staff, rowCount) {
    const named = (role) => staffName(staff, role)
    const medical = [named("physio"), named("doctor")].filter(Boolean).map(surnameFirst).join(" / ")
    if (rowCount === 3) {
        const assistants = [named("assistant"), named("assistant2")].filter(Boolean)
        return [surnameFirst(named("coach")), assistants.map(surnameFirst).join(" / "), medical]
    }
    const coaches = [named("coach"), named("assistant"), named("assistant2")]
    return [...coaches.map((name) => surnameFirst(name)), medical]
}

/**
 * Inscripción de un lado.
 * @param {import("./canvas.js").SheetCanvas} canvas lienzo
 * @param {object} context contexto de la hoja
 * @param {"home"|"away"} side lado
 */
function drawTeam(canvas, context, side) {
    const grid = context.layout.roster
    const rows = grid.rows
    const spot = grid[side]
    const team = context.match.teams[side]
    const [shirtX, shirtW] = spot.shirt
    const [nameX, nameW] = spot.name

    const [letterX, letterY] = spot.letter
    const letter = context.letterOf(side)
    canvas.text(letterX - 1.6, letterY - 1.95, 3.2, 3.9, letter, { align: "center", bold: true })
    const [codeX, codeY, codeW, codeH] = spot.code
    let codeAlign = "left"
    if (side === "home") {
        codeAlign = "right"
    }
    canvas.text(codeX, codeY, codeW, codeH, context.codes[side], { align: codeAlign, bold: true })

    const labelFor = rosterSurnames(team.players)
    const ordered = [...team.players].sort((a, b) => shirtRank(a) - shirtRank(b))
    const spare = rows.count - Math.min(ordered.length, rows.count)
    const forfeit = context.match.forfeit
    const absent = forfeit?.reason === "noShow" && forfeit.side === side
    const bottom = rows.top + rows.count * rows.step
    // Las filas que sobran se cierran para que nadie pueda añadir a mano a un jugador.
    if (spare > 0 && !absent) {
        const firstFree = rows.top + (rows.count - spare) * rows.step + rows.step / 2
        const left = shirtX + 0.5
        canvas.tail(left, firstFree, nameX + nameW - 0.5, left, bottom - 0.5)
    }
    // Equipo que no se presenta (FIVB 6.4.1-2): se tachan su inscripción y sus oficiales.
    if (absent) {
        const [staffX, staffW] = spot.staff
        const staffTop = grid.staffRows[0][0]
        const [lastY, lastH] = grid.staffRows[grid.staffRows.length - 1]
        const inset = 0.35
        canvas.line(nameX + nameW - inset, rows.top + inset, shirtX + inset, bottom - inset, inset)
        canvas.line(staffX + staffW - inset, staffTop + inset, staffX + inset,
            lastY + lastH - inset, inset)
    }
    for (const [index, player] of ordered.slice(0, rows.count).entries()) {
        const y = rows.top + index * rows.step
        canvas.text(shirtX, y, shirtW, rows.step, player.shirt, { align: "center" })
        if (player.captain) {
            canvas.ring(shirtX + shirtW / 2, y + rows.step / 2, 1.9)
        }
        // Las marcas se reservan a 1,55 mm por carácter y el nombre deja 0,7 mm a cada lado.
        const marks = markSuffix(player).trim()
        let room = 0
        if (marks) {
            room = marks.length * 1.55 + 0.7
        }
        canvas.text(nameX + 0.7, y, nameW - 1.4 - room, rows.step, labelFor(player))
        if (marks) {
            canvas.text(nameX + nameW - 0.7 - room, y, room, rows.step, marks, { align: "right" })
        }
    }

    const [staffX, staffW] = spot.staff
    for (const [index, line] of staffLines(team.staff, grid.staffRows.length).entries()) {
        const [y, h] = grid.staffRows[index]
        canvas.text(staffX, y, staffW, h, line)
    }
}

/**
 * Dibuja la inscripción de los dos equipos: primero el local y después el visitante.
 * @param {import("./canvas.js").SheetCanvas} canvas lienzo
 * @param {object} context contexto de la hoja
 */
export function drawRosters(canvas, context) {
    drawTeam(canvas, context, "home")
    drawTeam(canvas, context, "away")
}
