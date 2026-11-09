/**
 * Cabecera del acta (competición, fecha, equipos y pabellón) y renglones de árbitros y
 * anotador del pie.
 * @module src/sheet/header.js
 */

import { shortDate } from "./metrics.js"
import { surnameFirst } from "./names.js"

/**
 * Escribe en un renglón descrito por [x, base, ancho].
 * @param {import("./canvas.js").SheetCanvas} canvas lienzo
 * @param {number[]} spot renglón
 * @param {unknown} value texto
 * @param {object} [options] opciones de SheetCanvas#text
 */
function fill(canvas, [x, base, w], value, options) {
    canvas.baseline(x, base, w, value, options)
}

/**
 * Une las partes que tienen contenido.
 * @param {unknown[]} parts partes
 * @param {string} glue separador
 * @returns {string}
 */
function joinFilled(parts, glue) {
    return parts.filter(Boolean).join(glue)
}

/**
 * Rellena la cabecera. Rodea la letra A o B de cada equipo solo cuando ya se sabe quién es el
 * equipo A, que es el que empieza el primer set a la izquierda del anotador.
 * @param {import("./canvas.js").SheetCanvas} canvas lienzo
 * @param {object} context contexto de la hoja (ver index.js)
 */
export function drawHeader(canvas, context) {
    const { info, layout } = context
    const head = layout.head
    fill(canvas, head.competition, joinFilled([info.competition, info.category], " · "))
    fill(canvas, head.date, shortDate(info.date))
    const [hours, minutes] = String(info.time || "").split(":")
    fill(canvas, head.hour, hours || "", { align: "right" })
    fill(canvas, head.minute, minutes || "")
    fill(canvas, head.home, info.homeName)
    fill(canvas, head.away, info.awayName)
    if (context.sideA) {
        const letters = layout.letters
        const [homeX, homeY] = letters.home[context.letterOf("home")]
        const [awayX, awayY] = letters.away[context.letterOf("away")]
        canvas.ring(homeX, homeY, letters.radius)
        canvas.ring(awayX, awayY, letters.radius)
    }
    fill(canvas, head.venue, joinFilled([info.venue, info.town], " - "))
}

/**
 * Rellena los renglones del primer árbitro, el segundo y el anotador: nombre y licencia. La
 * licencia del primero va algo más baja y más pequeña porque encima lleva impreso el rótulo.
 * @param {import("./canvas.js").SheetCanvas} canvas lienzo
 * @param {object} context contexto de la hoja
 */
export function drawReferees(canvas, context) {
    const { info, layout } = context
    const officials = layout.officials
    const people = [info.referee1, info.referee2, info.scorer]
    const licences = [info.referee1Licence, info.referee2Licence, info.scorerLicence]
    for (const [index, person] of people.entries()) {
        const base = officials.bases[index]
        let licenceBase = base
        let size = 9.5
        if (index === 0) {
            licenceBase = base + officials.licenceLift
            size = 8.5
        }
        const [nameX, nameW] = officials.name
        canvas.baseline(nameX, base, nameW, surnameFirst(person))
        const [licenceX, licenceW] = officials.licence
        const licence = licences[index]
        canvas.baseline(licenceX, licenceBase, licenceW, licence, { align: "center", size })
    }
}
