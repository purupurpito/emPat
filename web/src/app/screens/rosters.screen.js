/**
 * Pantalla: plantillas de los dos equipos.
 * @module src/app/screens/rosters.screen.js
 */

import { Screen } from "../screen.js"
import { ROSTER_TEXT, rostersView } from "../views/rosters.view.js"
import { SignatureDialog } from "../dialogs/signature.js"
import { teamLabel } from "../views/common.view.js"
import { teamColor } from "../colors.js"
import { properCase } from "../format.js"
import { saveAndRender } from "./details.screen.js"
import { STAFF_TITLES, isValidShirt, normalizeShirt } from "../../rules/index.js"

/**
 * Filas vacías con las que empieza una plantilla sin jugadores ni plantilla recordada.
 */
const BLANK_ROWS = 12

/**
 * Todos los cargos del cuerpo técnico en su orden, cada uno con el nombre que ya tuviera
 * (FIVB 4.1.1).
 * @param {object[]|undefined} staff cargos escritos
 * @returns {{role: string, name: string}[]}
 */
function allStaffRoles(staff) {
    const written = staff || []
    const roles = []
    for (const role of Object.keys(STAFF_TITLES)) {
        const found = written.find((member) => member.role === role)
        roles.push({ role, name: found?.name || "" })
    }
    return roles
}

/**
 * Fila vacía de jugador.
 * @returns {{shirt: string, name: string}}
 */
function blankRow() {
    return { shirt: "", name: "" }
}

/**
 * Jugador listo para la jugada de plantilla: dorsal normalizado, nombre con mayúsculas
 * iniciales y solo las marcas que lleva.
 * @param {object} row fila del borrador
 * @returns {object}
 */
function enrolled(row) {
    const player = {
        shirt: normalizeShirt(row.shirt),
        name: properCase(String(row.name || "").trim()),
    }
    if (row.captain) {
        player.captain = true
    }
    if (row.libero) {
        player.libero = true
    }
    if (row.category) {
        player.category = row.category
    }
    return player
}

/**
 * Plantillas de los dos equipos, editadas en borradores que viven en la sesión hasta que se
 * confirman. Cualquier acción que repinta (añadir o quitar filas, firmar, volver) empieza
 * leyendo lo escrito, para no perderlo. Al seguir, cada equipo se valida y se guarda por
 * orden: primero el local y después el visitante.
 */
export class RostersScreen extends Screen {
    /**
     * Eventos delegados de la pantalla.
     */
    static events = {
        "click [data-add-row]": "addRow",
        "click [data-remove-row]": "removeRow",
        "input [data-col=shirt]": "flagShirt",
        "click [data-sign-slot]": "sign",
        "click #go-back": "back",
        "click #go-next": "next",
    }

    /**
     * Marcado de la pantalla.
     * @returns {Markup}
     */
    view() {
        const record = this.app.session.record
        const info = record.info
        const liberoAllowed = Boolean(record.settings.liberoAllowed)
        const tables = ["home", "away"].map((side) => ({
            side,
            name: teamLabel(info, side),
            tint: teamColor(info, side),
            liberoAllowed,
            draft: this.#draft(side),
            setAside: record.setAside?.[side] || [],
            delegate: info[side + "Delegate"] || "",
        }))
        return rostersView({ liberoAllowed, tables, signatures: this.app.session.match.signatures })
    }

    /**
     * Borrador de un equipo; lo crea la primera vez. Parte de la plantilla confirmada (más los
     * apartados, si los hay); sin plantilla, de la recordada para ese equipo o de filas vacías.
     * @param {"home"|"away"} side lado
     * @returns {{players: object[], staff: object[]}}
     */
    #draft(side) {
        const session = this.app.session
        if (session.drafts[side]) {
            return session.drafts[side]
        }
        const team = session.match.teams[side]
        const copies = team.players.map((player) => ({ ...player }))
        const setAside = session.record.setAside?.[side] ?? []
        const draft = { players: copies, staff: allStaffRoles(team.staff) }
        if (setAside.length > 0) {
            draft.players = [...copies, ...setAside.map((player) => ({ ...player }))]
        } else if (copies.length === 0) {
            draft.players = Array.from({ length: BLANK_ROWS }, blankRow)
            this.#recall(draft, side)
        }
        session.drafts[side] = draft
        return draft
    }

    /**
     * Sustituye un borrador vacío por la plantilla recordada del equipo, sin las filas en
     * blanco. Un dato recordado roto se ignora.
     * @param {object} draft borrador nuevo
     * @param {"home"|"away"} side lado
     */
    #recall(draft, side) {
        try {
            const team = teamLabel(this.app.session.record.info, side)
            const remembered = this.app.store.recallTeam(team)
            if (!remembered) {
                return
            }
            Object.assign(draft, {
                ...remembered,
                staff: allStaffRoles(remembered.staff),
                players: remembered.players.filter((player) => player.name || player.shirt),
            })
        } catch {
            // Una plantilla recordada ilegible no impide escribir una nueva.
        }
    }

    /**
     * Copia lo escrito en la tarjeta de un equipo a su borrador y el delegado a los datos.
     * @param {"home"|"away"} side lado
     */
    #read(side) {
        const card = this.root.querySelector(`[data-side="${side}"]`)
        const draft = this.#draft(side)
        for (const input of card.querySelectorAll("[data-col]")) {
            const player = draft.players[Number(input.dataset.row)]
            const column = input.dataset.col
            if (column === "shirt" || column === "name") {
                player[column] = input.value
            } else if (column === "category") {
                if (input.value) {
                    player.category = input.value
                } else {
                    delete player.category
                }
            } else {
                player[column] = input.checked
            }
        }
        for (const input of card.querySelectorAll("[data-staff]")) {
            draft.staff[Number(input.dataset.staff)].name = input.value.trim()
        }
        for (const input of card.querySelectorAll("[data-delegate]")) {
            this.app.session.record.info[side + "Delegate"] = input.value.trim()
        }
    }

    /**
     * Lee las dos tarjetas.
     */
    #readBoth() {
        this.#read("home")
        this.#read("away")
    }

    /**
     * Vuelve a pintar solo esta pantalla con los borradores actuales.
     */
    #redraw() {
        this.mount(this.root)
    }

    /**
     * Añade una fila vacía al equipo de la tarjeta.
     * @param {Event} event clic
     * @param {HTMLElement} button botón de la tarjeta
     */
    addRow(event, button) {
        const side = button.closest("[data-side]").dataset.side
        this.#readBoth()
        this.#draft(side).players.push(blankRow())
        this.#redraw()
    }

    /**
     * Quita la fila del botón pulsado.
     * @param {Event} event clic
     * @param {HTMLElement} button botón de la fila
     */
    removeRow(event, button) {
        const side = button.closest("[data-side]").dataset.side
        this.#readBoth()
        this.#draft(side).players.splice(Number(button.dataset.removeRow), 1)
        this.#redraw()
    }

    /**
     * Marca en rojo un dorsal no válido mientras se escribe.
     * @param {Event} event entrada de texto
     * @param {HTMLInputElement} input campo del dorsal
     */
    flagShirt(event, input) {
        const typed = input.value.trim()
        if (typed && !isValidShirt(typed)) {
            input.setAttribute("aria-invalid", "true")
        } else {
            input.removeAttribute("aria-invalid")
        }
    }

    /**
     * Abre la firma de una casilla previa sin perder lo escrito.
     * @param {Event} event clic
     * @param {HTMLElement} button botón de la casilla
     */
    sign(event, button) {
        this.#readBoth()
        new SignatureDialog(this.app).open({
            slot: button.dataset.signSlot,
            label: button.dataset.signLabel,
        })
    }

    /**
     * Vuelve a los datos guardando lo escrito en los datos (no las plantillas).
     */
    back() {
        this.#readBoth()
        this.app.session.record.stage = "details"
        saveAndRender(this.app)
    }

    /**
     * Valida y guarda las dos plantillas y pasa al sorteo. Si un equipo falla se avisa y se
     * para; lo ya aceptado del otro queda en el acta abierta, como al seguir uno por uno.
     */
    next() {
        this.#readBoth()
        const app = this.app
        const record = app.session.record
        for (const side of ["home", "away"]) {
            if (!this.#commitSide(side)) {
                return
            }
        }
        delete record.setAside
        record.stage = "toss"
        saveAndRender(app)
        scrollTo(0, 0)
    }

    /**
     * Valida un equipo y, si pasa, sustituye su jugada de plantilla y la recuerda para la
     * próxima vez.
     * @param {"home"|"away"} side lado
     * @returns {boolean} si se aceptó
     */
    #commitSide(side) {
        const app = this.app
        const record = app.session.record
        const draft = this.#draft(side)
        const team = teamLabel(record.info, side)
        const nameless = draft.players.filter((player) => String(player.shirt).trim() === ""
            && String(player.name || "").trim())
        if (nameless.length > 0) {
            const names = nameless.slice(0, 3).map((player) => player.name)
            app.notifier.show(ROSTER_TEXT.missingShirt(team, names, nameless.length > 3))
            return false
        }
        const wrong = draft.players.filter((player) => String(player.shirt ?? "").trim() !== ""
            && !isValidShirt(player.shirt))
        if (wrong.length > 0) {
            const shirts = wrong.map((player) => String(player.shirt).trim())
            app.notifier.show(ROSTER_TEXT.badShirt(team, shirts))
            const selector = `[data-side="${side}"] [data-col=shirt][aria-invalid="true"]`
            this.root.querySelector(selector)?.focus()
            return false
        }
        const players = draft.players
            .filter((player) => String(player.shirt).trim() !== "")
            .map(enrolled)
        const play = {
            kind: "roster",
            side,
            name: team,
            players,
            staff: draft.staff.filter((member) => member.name),
        }
        if (players.filter((player) => !player.libero).length < 6) {
            app.notifier.show(ROSTER_TEXT.fewPlayers(team))
            return false
        }
        if (!players.some((player) => player.captain)) {
            app.notifier.show(ROSTER_TEXT.noCaptain(team))
            return false
        }
        const refusal = app.rules.check(record.settings, record.info, record.plays, play)
        if (refusal) {
            app.notifier.show(ROSTER_TEXT.refused(team, refusal))
            return false
        }
        record.plays = record.plays.filter((old) => !(old.kind === "roster" && old.side === side))
        record.plays.push({ ...play, at: new Date().toISOString() })
        const kept = draft.players.filter((player) => player.shirt || player.name)
        app.store.rememberTeam(team, { players: kept, staff: draft.staff })
        return true
    }
}
