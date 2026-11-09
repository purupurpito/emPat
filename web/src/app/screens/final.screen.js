/**
 * Pantalla: final, firmas y aprobación.
 * @module src/app/screens/final.screen.js
 */

import { Screen } from "../screen.js"
import { ask } from "../dialog.js"
import { serializeRecord } from "../record.js"
import { SEAL_PIN, SEAL_SIGNERS, SIGNER_LABELS, UI_TEXT } from "../constants.js"
import { FINAL_TEXT, finalView } from "../views/final.view.js"
import { SignatureDialog } from "../dialogs/signature.js"
import { ReopenDialog } from "../dialogs/reopen.js"
import { RemarkDialog } from "../dialogs/remark.js"
import { showPaper } from "./paper.screen.js"

/**
 * Nombre del archivo de exportación desde la pantalla final: fecha y equipo local, con los
 * caracteres raros cambiados por guiones para que sirva en cualquier sistema de archivos.
 * @param {object} info datos del encuentro
 * @returns {string}
 */
function exportFileName(info) {
    const team = (info.homeName || "").replace(/\W+/g, "-")
    return `acta-${info.date || ""}-${team}.json`
}

/**
 * Descarga un acta como archivo JSON en el formato de exportación.
 * @param {object} record acta
 * @param {string} fileName nombre del archivo
 */
function downloadRecord(record, fileName) {
    const blob = new Blob([serializeRecord(record)], { type: "application/json" })
    const link = document.createElement("a")
    link.href = URL.createObjectURL(blob)
    link.download = fileName
    link.click()
}

/**
 * Valor que se guarda del campo de espectadores: vacío si se borra; si no, un entero no
 * negativo en texto (lo que no es número cuenta como cero).
 * @param {string} typed lo escrito
 * @returns {string}
 */
function attendanceValue(typed) {
    const text = typed.trim()
    if (text === "") {
        return ""
    }
    return String(Math.max(0, Math.floor(Number(text)) || 0))
}

/**
 * Pantalla final del partido: resultado, set obligatorio, golden set, espectadores,
 * observaciones, correcciones, firmas, aprobación con claves, reapertura y exportación.
 */
export class FinalScreen extends Screen {
    /**
     * Eventos delegados de la pantalla.
     */
    static events = {
        "click #open-golden": "golden",
        "change #attendance": "attendance",
        "change [data-full-set]": "fullSetMark",
        "click [data-sign-slot]": "sign",
        "click #seal-record": "seal",
        "click #reopen": "reopen",
        "click #open-note": "note",
        "click #open-paper": "paper",
        "click #export-json": "exportJson",
        "click #undo": "undo",
        "click #go-list": "leave",
    }

    /**
     * Marcado de la pantalla.
     * @returns {Markup}
     */
    view() {
        const { record, match } = this.app.session
        const rules = this.app.rules
        let fullSet = null
        if (match.settings.fullSetRule) {
            const started = match.periods.filter((period) => period.startedAt)
            fullSet = {
                report: rules.fullSetReport(match),
                numbers: started.map((period) => period.number),
            }
        }
        return finalView({
            info: record.info,
            summary: rules.summarize(match),
            forfeit: match.forfeit,
            fullSet,
            goldenOffered: !record.sealed && !match.golden && !match.forfeit,
            notes: match.notes,
            amendments: record.amendments || [],
            signatures: match.signatures,
            sealed: record.sealed,
        })
    }

    /**
     * Con el partido acabado sobra mantener la pantalla encendida.
     */
    mounted() {
        this.app.wake.release()
    }

    /**
     * Abre el golden set tras confirmarlo.
     */
    golden() {
        if (ask(FINAL_TEXT.askGolden)) {
            this.app.session.commit({ kind: "openGolden" })
        }
    }

    /**
     * Guarda los espectadores en los datos del acta, sin pasar por el motor: no es una jugada.
     * @param {Event} event cambio
     * @param {HTMLInputElement} input campo
     */
    attendance(event, input) {
        const { store, notifier } = this.app
        const record = this.app.session.record
        record.info.attendance = attendanceValue(input.value)
        if (!store.save(record)) {
            notifier.show(UI_TEXT.saveFailed)
        }
        notifier.show(FINAL_TEXT.attendanceSaved, { good: true })
    }

    /**
     * Marca o desmarca a mano un set como completo para un jugador.
     * @param {Event} event cambio
     * @param {HTMLInputElement} box casilla con "lado|dorsal|set"
     */
    fullSetMark(event, box) {
        const [side, shirt, period] = box.dataset.fullSet.split("|")
        this.app.session.commit({
            kind: "fullSetMark",
            side,
            shirt,
            period: Number(period),
            value: box.checked,
        })
    }

    /**
     * Abre la firma de una casilla.
     * @param {Event} event clic
     * @param {HTMLElement} button botón con la casilla y su rótulo
     */
    sign(event, button) {
        const { signSlot, signLabel } = button.dataset
        new SignatureDialog(this.app).open({ slot: signSlot, label: signLabel })
    }

    /**
     * Aprueba y cierra el acta si las cuatro claves son correctas y se confirma. La primera
     * clave que falla se señala y recibe el foco.
     */
    seal() {
        for (const slot of SEAL_SIGNERS) {
            const field = this.root.querySelector(`[data-pin="${slot}"]`)
            if (field.value !== SEAL_PIN) {
                this.app.notifier.show(FINAL_TEXT.wrongPin(SIGNER_LABELS[slot]))
                field.focus()
                return
            }
        }
        if (ask(FINAL_TEXT.askSeal)) {
            this.app.session.seal()
        }
    }

    /**
     * Pide la clave del primer árbitro para reabrir el acta.
     */
    reopen() {
        new ReopenDialog(this.app).open()
    }

    /**
     * Abre el diálogo de observaciones.
     */
    note() {
        new RemarkDialog(this.app).open()
    }

    /**
     * Pasa a la vista del acta para imprimir.
     */
    paper() {
        showPaper(this.app)
    }

    /**
     * Descarga el acta en JSON.
     */
    exportJson() {
        const record = this.app.session.record
        downloadRecord(record, exportFileName(record.info))
    }

    /**
     * Deshace la última jugada.
     */
    undo() {
        this.app.session.undo()
    }

    /**
     * Cierra el acta y vuelve a la lista.
     */
    leave() {
        this.app.session.leave()
    }
}
