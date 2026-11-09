/**
 * Pantalla final, firmas y aprobación. Función pura: recibe un modelo y devuelve marcado; no
 * lee estado global.
 *
 * Arriba, el veredicto en tinta: ganador, sets de cada equipo y parciales. Debajo, en dos
 * columnas en pantalla ancha: a la izquierda lo que se completa del acta (detalle por set, set
 * obligatorio, golden set, espectadores, observaciones y correcciones) y a la derecha el cierre,
 * con las firmas como una lista ordenada de pasos y la aprobación. La barra fija del pie lleva a
 * ver e imprimir el acta.
 * @module src/app/views/final.view.js
 */

import { html, raw } from "../dom.js"
import { clockTime } from "../format.js"
import { colorVars, teamColor } from "../colors.js"
import { CLOSING_SIGNERS, SEAL_SIGNERS, SIGNER_LABELS } from "../constants.js"
import { actionDock, resultsTable, stepper, teamLabel } from "./common.view.js"

/**
 * Textos que la pantalla final enseña fuera del marcado: avisos y preguntas de confirmación.
 */
export const FINAL_TEXT = Object.freeze({
    askGolden: "¿Quieres jugar el golden set? Es un set extra de desempate y no altera el "
        + "resultado de este partido.",
    askSeal: "¿Confirmas que apruebas y cierras el acta? A partir de ahí no admitirá cambios.",
    attendanceSaved: "Número de espectadores guardado.",
    wrongPin: (title) => `Contraseña del ${title.toLowerCase()} incorrecta.`,
})

/**
 * Explicación del set obligatorio en la categoría infantil.
 */
const FULL_SET_HINT = "Se marcan solos los titulares que han jugado el set entero sin ser "
    + "sustituidos. Si un caso debe contar distinto (por ejemplo, un cambio especial), corrígelo "
    + "con la casilla y quedará señalado con ✎."

/**
 * Cuándo se juega el golden set y qué supone.
 */
const GOLDEN_HINT = "Úsalo solo para desempatar, por ejemplo una eliminatoria a doble partido "
    + "que acaba igualada. Es un set extra a 15 puntos, con sorteo, que no altera el resultado de "
    + "este partido."

/**
 * Qué implica aprobar el acta y la clave de prueba.
 */
const SEAL_HINT = "Revisa primero el acta con «Revisar e imprimir». Una vez aprobada queda "
    + "cerrada: ya no se anota ni se deshace nada, aunque las firmas sí se pueden rehacer. "
    + "Contraseña de prueba para todos: 0000."

/**
 * Por qué el acta aprobada no se envía a ningún sitio.
 */
const SEALED_HINT = "Por ahora no hay forma de enviarla a la FCVB, que aún no dispone de un "
    + "sistema para recibirla. Mientras tanto, imprímela o guárdala como PDF."

/**
 * Orden de firma al cerrar (FIVB 27.2.3.3).
 */
const SIGNING_ORDER = "Orden de firma: anotador y asistente, capitanes, 2º árbitro y, por "
    + "último, 1er árbitro (FIVB 27.2.3.3)."

/**
 * Botón para reabrir un acta aprobada; solo puede hacerlo el primer árbitro.
 */
const REOPEN_LABEL = "Reabrir (solo el 1er árbitro)"

/**
 * Confirmación de que nadie se ha quedado sin set completo.
 */
const EVERYONE_PLAYED = "Todo el equipo cumple: cada jugador tiene al menos un set completo."

/**
 * Qué es la lista de correcciones.
 */
const AMENDMENTS_HINT = "Registro de todo lo que se ha deshecho en el partido. Forma parte del "
    + "acta y no se puede eliminar."

/**
 * Límites del campo de espectadores; el teclado numérico basta en el móvil.
 */
const ATTENDANCE_LIMITS = raw("min=\"0\" max=\"100000\" inputmode=\"numeric\"")

/**
 * Ancho de la casilla de espectadores, que solo lleva un número.
 */
const NARROW = raw("style=\"max-width:220px\"")

/**
 * Opciones de fecha y hora cortas para el momento de la aprobación.
 */
const SEAL_STAMP = Object.freeze({ dateStyle: "short", timeStyle: "short" })

/**
 * Fecha y hora cortas, en formato peninsular, del momento en que se aprobó el acta.
 * @param {string} iso marca de la aprobación
 * @returns {string}
 */
export function sealStamp(iso) {
    return new Date(iso).toLocaleString("es-ES", SEAL_STAMP)
}

/**
 * Pone las líneas del informe de set completo en el orden en que salen al recorrer un objeto
 * indexado por dorsal: los dorsales numéricos de menor a mayor y después el resto (como "00")
 * en el orden de la plantilla. Es el orden en que se listan en pantalla y en el resumen.
 * @param {Array<{shirt: string}>} lines líneas de un equipo
 * @returns {Array<object>}
 */
export function byShirtKey(lines) {
    const keyed = {}
    for (const line of lines) {
        keyed[line.shirt] = line
    }
    return Object.values(keyed)
}

/**
 * Titular con el ganador y el resultado en sets.
 * @param {object} info datos del encuentro
 * @param {object} summary resumen del partido
 * @returns {string}
 */
function winnerLine(info, summary) {
    const { home, away } = summary.totals
    const high = Math.max(home.won, away.won)
    const low = Math.min(home.won, away.won)
    return `Victoria de ${teamLabel(info, summary.winner) ?? ""}, ${high}-${low}`
}

/**
 * Aviso de por qué acabó el partido sin jugarse entero, si fue así.
 * @param {object} info datos del encuentro
 * @param {object|null} forfeit fin anticipado del motor
 * @returns {Markup|null}
 */
function forfeitNote(info, forfeit) {
    if (!forfeit) {
        return null
    }
    const team = teamLabel(info, forfeit.side) ?? ""
    let text = `Por incomparecencia de ${team}.`
    if (forfeit.reason !== "noShow") {
        text = `Equipo incompleto: ${team} en el set ${forfeit.period} (${
            forfeit.home}-${forfeit.away}).`
    }
    return html`<p class="verdict-forfeit">${text}</p>`
}

/**
 * Sets ganados por cada equipo, frente a frente, con el ganador resaltado.
 * @param {object} info datos del encuentro
 * @param {object} summary resumen del partido
 * @returns {Markup}
 */
function verdictBoard(info, summary) {
    const team = (side) => {
        const winner = summary.winner === side ? " is-winner" : ""
        return html`<div class="verdict-team${winner}"><span class="verdict-name"><span ${
            ""}class="swatch" style="background:${teamColor(info, side)}" aria-hidden="true"></span>${
            teamLabel(info, side)}</span><span class="verdict-sets">${
            summary.totals[side].won}</span></div>`
    }
    return html`<div class="verdict-board">${team("home")}<span class="verdict-dash" ${
        ""}aria-hidden="true">–</span>${team("away")}</div>`
}

/**
 * Parciales de cada set como fichas, con el color del ganador del set y sus minutos.
 * @param {object} info datos del encuentro
 * @param {object} summary resumen del partido
 * @returns {Markup|null}
 */
function verdictSets(info, summary) {
    if (summary.rows.length === 0) {
        return null
    }
    const chips = summary.rows.map((row) => {
        const { home, away } = row
        let tint = null
        if (home.points !== away.points) {
            tint = raw(` style="${colorVars(info, home.points > away.points ? "home" : "away")}"`)
        }
        const length = row.minutes === null || row.minutes === undefined
            ? null
            : html`<small>${row.minutes} min</small>`
        return html`<li${tint}><b>Set ${row.period}</b> <span>${home.points}-${
            away.points}</span>${length}</li>`
    })
    return html`<ol class="verdict-chips">${chips}</ol>`
}

/**
 * Casilla de un set en la tabla del set obligatorio, con la marca de corrección a mano.
 * @param {"home"|"away"} side lado
 * @param {string} shirt dorsal
 * @param {object} entry estado del jugador en ese set
 * @returns {Markup}
 */
function fullSetCell(side, shirt, entry) {
    const checked = entry.complete ? raw(" checked") : ""
    const manual = entry.manual !== null
        ? html`<span class="fine dim" title="Corregido a mano">✎</span>`
        : ""
    return html`<td><label class="check"><input type="checkbox" data-full-set="${side}|${shirt}|${
        entry.period}"${checked} aria-label="${shirt} set ${entry.period} completo">${
        manual}</label></td>`
}

/**
 * Fila de un jugador en la tabla del set obligatorio.
 * @param {"home"|"away"} side lado
 * @param {object} line línea del informe
 * @returns {Markup}
 */
function fullSetRow(side, line) {
    const cells = line.periods.map((entry) => fullSetCell(side, line.shirt, entry))
    const verdict = line.ok
        ? html`<span class="mark-yes">✓</span>`
        : html`<span class="mark-no">Falta</span>`
    return html`<tr class="${line.ok ? "" : "fullset-miss"}"><td><b>${line.shirt}</b></td><td>${
        line.name}</td>${cells}<td>${verdict}</td></tr>`
}

/**
 * Tabla del set obligatorio de un equipo.
 * @param {object} info datos del encuentro
 * @param {"home"|"away"} side lado
 * @param {object[]} lines líneas del informe, ya ordenadas
 * @param {number[]} numbers números de los sets empezados, para las cabeceras
 * @returns {Markup}
 */
function fullSetSide(info, side, lines, numbers) {
    const heads = numbers.map((number) => html`<th>Set ${number}</th>`)
    const title = html`<h3 class="closing-sub">${teamLabel(info, side)}</h3>`
    const head = html`<thead><tr><th>Nº</th><th>Jugador</th>${heads}<th></th></tr></thead>`
    return html`<div>${title}<table class="grid-table fullset-table">${head}<tbody>${
        lines.map((line) => fullSetRow(side, line))}</tbody></table></div>`
}

/**
 * Resumen de quién no tiene ningún set completo, o la confirmación de que todos lo tienen.
 * @param {object} info datos del encuentro
 * @param {{home: object[], away: object[]}} lines líneas ordenadas de cada equipo
 * @returns {Markup}
 */
function fullSetVerdict(info, lines) {
    const groups = []
    for (const side of ["home", "away"]) {
        const missing = lines[side].filter((line) => !line.ok)
        if (missing.length > 0) {
            const shirts = missing.map((line) => line.shirt).join(", ")
            groups.push(`${teamLabel(info, side) ?? ""}: ${shirts}`)
        }
    }
    if (groups.length === 0) {
        return html`<p class="banner banner--good">${EVERYONE_PLAYED}</p>`
    }
    return html`<p class="banner banner--bad">Jugadores sin set completo: ${groups.join(" · ")}</p>`
}

/**
 * Tabla del set obligatorio (categoría infantil): por jugador y set, si lo jugó entero, con
 * casilla para corregirlo a mano.
 * @param {{info: object, report: {home: object[], away: object[]}, numbers: number[]}} model
 *     datos del encuentro, informe del motor y números de los sets empezados
 * @returns {Markup} marcado HTML
 */
function fullSetTable({ info, report, numbers }) {
    const lines = { home: byShirtKey(report.home), away: byShirtKey(report.away) }
    return html`<section class="panel"><h2>Set completo obligatorio</h2><p class="fine dim">${
        FULL_SET_HINT}</p>${fullSetVerdict(info, lines)}<div class="duo">${
        fullSetSide(info, "home", lines.home, numbers)}${
        fullSetSide(info, "away", lines.away, numbers)}</div></section>`
}

/**
 * Una corrección: hora, set, marcador de entonces y lo que se deshizo.
 * @param {object} info datos del encuentro
 * @param {object} entry corrección
 * @returns {Markup}
 */
function amendmentItem(info, entry) {
    return html`<li><span class="amend-time">${clockTime(entry.at)}</span> Set ${entry.period} (${
        info.homeName} ${entry.home}-${entry.away} ${info.awayName}): ${entry.text}</li>`
}

/**
 * Lista de correcciones del anotador. Sin correcciones no pinta nada.
 * @param {{info: object, amendments: object[]}} model datos del encuentro y correcciones
 * @returns {Markup|string} marcado HTML
 */
function amendmentList({ info, amendments }) {
    if (amendments.length === 0) {
        return ""
    }
    const items = amendments.map((entry) => amendmentItem(info, entry))
    const title = html`<h2>Correcciones del acta</h2>`
    return html`<section class="panel">${title}<p class="fine dim">${AMENDMENTS_HINT}</p><ul ${
        ""}class="amend-list">${items}</ul></section>`
}

/**
 * Paso de la lista de firmas: número de orden (o ✓ si ya está), quién firma, la firma guardada
 * y el botón para firmar o volver a firmar.
 * @param {string} slot casilla
 * @param {number} index posición en el orden de firma
 * @param {object|undefined} signature firma guardada
 * @returns {Markup}
 */
function signStep(slot, index, signature) {
    const title = SIGNER_LABELS[slot]
    const mark = signature ? "✓" : index + 1
    let detail = html`<span class="sign-state">Falta la firma</span>`
    let image = null
    let action = "Firmar"
    let state = ""
    if (signature) {
        detail = html`<span class="sign-state">${signature.signer} · ${
            clockTime(signature.at)}</span>`
        image = html`<img class="sign-image" src="${signature.image}" alt="Firma de ${title}">`
        action = "Repetir firma"
        state = " is-signed"
    }
    const button = html`<button type="button" data-sign-slot="${slot}" data-sign-label="${
        title}">${action}</button>`
    return html`<li class="sign-step${state}"><span class="sign-mark" aria-hidden="true">${
        mark}</span><span class="sign-who"><b>${title}</b>${detail}</span>${image}${button}</li>`
}

/**
 * Firmas del cierre como lista ordenada de pasos, con el recuento de las que ya están.
 * @param {object} signatures firmas del partido
 * @returns {Markup}
 */
function signaturePanel(signatures) {
    const done = CLOSING_SIGNERS.filter((slot) => signatures[slot]).length
    const steps = CLOSING_SIGNERS.map((slot, index) => signStep(slot, index, signatures[slot]))
    return html`<section class="panel closing-signs" aria-labelledby="signs-title"><div ${
        ""}class="closing-head"><h2 id="signs-title">Firmas</h2><span class="counter">${
        done}/${CLOSING_SIGNERS.length}</span></div><p class="fine dim">${SIGNING_ORDER}</p><ol ${
        ""}class="sign-steps">${steps}</ol></section>`
}

/**
 * Campo de clave de una de las personas que aprueban.
 * @param {string} slot casilla de firma
 * @returns {Markup}
 */
function pinField(slot) {
    return html`<label class="field"><span>Contraseña · ${
        SIGNER_LABELS[slot]}</span><input type="password" data-pin="${
        slot}" inputmode="numeric" autocomplete="off"></label>`
}

/**
 * Bloque de aprobación: las claves para cerrar el acta o, si ya está cerrada, cuándo se aprobó
 * y el botón para reabrirla.
 * @param {{sealed: {at: string}|undefined|null}} model aprobación guardada
 * @returns {Markup} marcado HTML
 */
function sealPanel({ sealed }) {
    if (sealed) {
        const done = `El anotador, los capitanes y el 1er árbitro la aprobaron el ${
            sealStamp(sealed.at)}. Desde entonces no se puede anotar ni deshacer nada.`
        const reopen = html`<button type="button" id="reopen" class="quiet">${
            REOPEN_LABEL}</button>`
        return html`<section class="panel closing-seal is-sealed"><div class="closing-head"><span ${
            ""}class="seal-badge" aria-hidden="true">✓</span><h2>Acta aprobada</h2></div><p ${
            ""}class="seal-done">${done}</p><p class="fine dim">${SEALED_HINT}</p>${
            reopen}</section>`
    }
    const seal = html`<button type="button" class="cta" id="seal-record">${
        "Aprobar y cerrar"}</button>`
    return html`<section class="panel closing-seal"><div class="closing-head"><span ${
        ""}class="seal-badge" aria-hidden="true"></span><h2>Aprobación del acta</h2></div><p ${
        ""}class="fine dim">${SEAL_HINT}</p><div class="seal-pins">${
        SEAL_SIGNERS.map(pinField)}</div>${seal}</section>`
}

/**
 * Bloque para abrir el golden set, solo mientras se puede.
 * @param {boolean} offered si se ofrece
 * @returns {Markup|string}
 */
function goldenOffer(offered) {
    if (!offered) {
        return ""
    }
    return html`<section class="panel"><h2>Golden set</h2><p class="fine dim">${
        GOLDEN_HINT}</p><button type="button" id="open-golden">Comenzar el golden set</button>${
        raw("</section>")}`
}

/**
 * Bloque de espectadores, que se pueden apuntar hasta que el acta se aprueba.
 * @param {unknown} attendance valor guardado
 * @param {boolean} locked acta aprobada
 * @returns {Markup}
 */
function attendanceBox(attendance, locked) {
    const disabled = locked ? raw(" disabled") : ""
    const input = html`<input type="number" id="attendance" ${ATTENDANCE_LIMITS} value="${
        attendance ?? ""}"${disabled}>`
    const label = html`<span>Número de espectadores</span>`
    return html`<section class="panel"><h2>Espectadores</h2><label class="field" ${
        NARROW}>${label}${input}</label></section>`
}

/**
 * Bloque de observaciones del partido, con el botón para añadir otra mientras no esté
 * aprobada.
 * @param {object[]} notes observaciones del motor
 * @param {boolean} locked acta aprobada
 * @returns {Markup}
 */
function notesBox(notes, locked) {
    let body = html`<p class="fine dim">Sin observaciones.</p>`
    if (notes.length > 0) {
        const items = notes.map((note) => html`<li><span class="amend-time">Set ${
            note.period} · ${clockTime(note.at)}</span> ${note.text}</li>`)
        body = html`<ul class="note-list">${items}</ul>`
    }
    const add = locked
        ? ""
        : html`<button type="button" id="open-note">Nueva observación</button>`
    return html`<section class="panel"><h2>Observaciones</h2>${body}${add}</section>`
}

/**
 * Pantalla final: veredicto, detalle por set, set obligatorio, golden set, espectadores,
 * observaciones, correcciones, firmas, aprobación y acciones.
 * @param {{info: object, summary: object, forfeit: object|null, fullSet: object|null,
 *     goldenOffered: boolean, notes: object[], amendments: object[], signatures: object,
 *     sealed: object|undefined}} model datos ya calculados para pintar
 * @returns {Markup} marcado HTML
 */
export function finalView(model) {
    const { info, summary, sealed } = model
    const locked = Boolean(sealed)
    const fullSet = model.fullSet ? fullSetTable({ info, ...model.fullSet }) : ""
    const undo = locked
        ? ""
        : html`<button type="button" id="undo">Volver atrás un punto</button>`
    const download = html`<button type="button" id="export-json">Exportar datos (JSON)</button>`
    const verdict = html`<section class="verdict" aria-labelledby="verdict-title"><h2 ${
        ""}id="verdict-title">${winnerLine(info, summary)}</h2>${verdictBoard(info, summary)}${
        verdictSets(info, summary)}${forfeitNote(info, model.forfeit)}<div ${
        ""}class="verdict-actions">${undo}${download}</div></section>`
    const detail = html`<section class="panel"><h2>Detalle por sets</h2>${
        resultsTable({ summary, info })}</section>`
    const leave = html`<button type="button" class="quiet" id="go-list">Mis actas</button>`
    const paper = html`<button type="button" class="cta" id="open-paper">Revisar e imprimir</button>`
    return html`${stepper("final")}${verdict}<div class="closing"><div class="closing-main">${
        detail}${fullSet}${goldenOffer(model.goldenOffered)}<div class="closing-pair">${
        attendanceBox(info.attendance, locked)}${notesBox(model.notes, locked)}</div>${
        amendmentList({ info, amendments: model.amendments })}</div><div class="closing-side">${
        signaturePanel(model.signatures)}${sealPanel({ sealed })}</div></div>${
        actionDock(html`${leave}${paper}`)}`
}
