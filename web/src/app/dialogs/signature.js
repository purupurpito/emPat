/**
 * Controlador del diálogo: firma a mano.
 * @module src/app/dialogs/signature.js
 */

import { SIGNATURE_TEXT, signatureView } from "../views/dialogs/signature.view.js"
import { byId } from "../dom.js"

/**
 * Trazo de la firma: grosor, extremos y color.
 */
const STROKE = Object.freeze({ width: 2.5, cap: "round", color: "#000" })

/**
 * Nombre del capitán de un equipo con su dorsal, o cadena vacía si no hay capitán.
 * @param {Match} match partido
 * @param {"home"|"away"} side lado
 * @returns {string}
 */
function captainName(match, side) {
    const captain = match.teams[side].players.find((player) => player.captain)
    if (!captain) {
        return ""
    }
    return `${captain.name} (${captain.shirt})`
}

/**
 * Nombre del primer entrenador de un equipo, o cadena vacía.
 * @param {Match} match partido
 * @param {"home"|"away"} side lado
 * @returns {string}
 */
function coachName(match, side) {
    const coach = match.teams[side].staff.find((member) => member.role === "coach")
    return coach?.name || ""
}

/**
 * Nombre que se propone para cada casilla: capitanes y entrenadores salen de las plantillas;
 * árbitros y anotadores, de los datos del encuentro.
 * @param {string} slot casilla
 * @param {Match} match partido
 * @param {object} info datos del encuentro
 * @returns {string}
 */
function suggestedSigner(slot, match, info) {
    switch (slot) {
        case "homeCaptain":
        case "homeCaptainPre":
            return captainName(match, "home")
        case "awayCaptain":
        case "awayCaptainPre":
            return captainName(match, "away")
        case "homeCoachPre":
            return coachName(match, "home")
        case "awayCoachPre":
            return coachName(match, "away")
        case "scorer":
        case "assistantScorer":
        case "referee1":
        case "referee2":
            return info[slot] || ""
        default:
            return ""
    }
}

/**
 * Firma de una casilla: se dibuja en el lienzo y se guarda como imagen PNG junto con el nombre
 * de quien firma. Pedir guardar sin trazo o sin nombre solo avisa.
 */
export class SignatureDialog {
    /**
     * Eventos delegados sobre el cuerpo del diálogo.
     */
    static events = {
        "pointerdown #sig-pad": "penDown",
        "pointermove #sig-pad": "penMove",
        "pointerup #sig-pad": "penUp",
        "pointercancel #sig-pad": "penUp",
        "click #sig-clear": "clear",
        "click #sig-save": "save",
    }

    #app
    #slot = ""
    #drawing = false
    #inked = false

    /**
     * Guarda la aplicación.
     * @param {App} app aplicación
     */
    constructor(app) {
        this.#app = app
    }

    /**
     * Muestra el diálogo con el nombre propuesto para la casilla.
     * @param {{slot: string, label: string}} options casilla y su rótulo visible
     */
    open({ slot, label }) {
        const app = this.#app
        this.#slot = slot
        const match = app.session.match
        const signer = suggestedSigner(slot, match, app.session.record.info)
        app.dialog.open(signatureView({ label, signer }), { controller: this })
        const pen = this.#pen()
        pen.lineWidth = STROKE.width
        pen.lineCap = STROKE.cap
        pen.strokeStyle = STROKE.color
    }

    /**
     * Contexto de dibujo del lienzo.
     * @returns {CanvasRenderingContext2D}
     */
    #pen() {
        return byId("sig-pad").getContext("2d")
    }

    /**
     * Punto del evento en coordenadas del lienzo, que tiene más resolución que su caja.
     * @param {PointerEvent} event evento
     * @param {HTMLCanvasElement} pad lienzo
     * @returns {[number, number]}
     */
    #point(event, pad) {
        const box = pad.getBoundingClientRect()
        const x = (event.clientX - box.left) * pad.width / box.width
        const y = (event.clientY - box.top) * pad.height / box.height
        return [x, y]
    }

    /**
     * Empieza un trazo y captura el puntero para no perderlo al salir del lienzo.
     * @param {PointerEvent} event evento
     * @param {HTMLCanvasElement} pad lienzo
     */
    penDown(event, pad) {
        this.#drawing = true
        pad.setPointerCapture(event.pointerId)
        const pen = this.#pen()
        pen.beginPath()
        pen.moveTo(...this.#point(event, pad))
    }

    /**
     * Sigue el trazo mientras el puntero esté apretado.
     * @param {PointerEvent} event evento
     * @param {HTMLCanvasElement} pad lienzo
     */
    penMove(event, pad) {
        if (!this.#drawing) {
            return
        }
        const pen = this.#pen()
        pen.lineTo(...this.#point(event, pad))
        pen.stroke()
        this.#inked = true
    }

    /**
     * Acaba el trazo.
     */
    penUp() {
        this.#drawing = false
    }

    /**
     * Deja el lienzo en blanco.
     */
    clear() {
        const pad = byId("sig-pad")
        this.#pen().clearRect(0, 0, pad.width, pad.height)
        this.#inked = false
    }

    /**
     * Guarda la firma. La imagen y el nombre se leen con el diálogo aún abierto, porque cerrarlo
     * lo vacía; una segunda pulsación con el diálogo cerrado no hace nada.
     */
    save() {
        const app = this.#app
        const nameInput = byId("sig-name")
        if (!nameInput) {
            return
        }
        if (!this.#inked) {
            app.notifier.show(SIGNATURE_TEXT.emptyPad)
            return
        }
        const signer = nameInput.value.trim()
        if (!signer) {
            app.notifier.show(SIGNATURE_TEXT.noName)
            return
        }
        const image = byId("sig-pad").toDataURL("image/png")
        app.dialog.close()
        app.session.commit({ kind: "sign", slot: this.#slot, signer, image })
    }
}
