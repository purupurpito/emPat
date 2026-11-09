/**
 * Acta abierta y su partido reconstruido; único punto por el que entran y salen jugadas.
 * @module src/app/session.js
 */

import { createRecord, initialSettings } from "./record.js"
import { DEMO_INFO, SEALED_TEXT, SEAL_PIN, UI_TEXT } from "./constants.js"
import { DEMO_ROSTERS } from "./data/demo-rosters.js"
import { describePlay } from "./describe.js"
import { ask } from "./dialog.js"
import { clockTime } from "./format.js"

/**
 * Jugadas que no se pueden deshacer desde el partido: se cambian en sus propias pantallas.
 */
const NOT_UNDOABLE = new Set(["roster", "sign"])

/**
 * Jugadas que se deshacen junto con el inicio de set que las sigue, porque se confirmaron con
 * él en un solo paso.
 */
const SET_START_PARTS = new Set(["lineup", "toss"])

/**
 * Espera por defecto entre dos puntos para no tomar un doble toque por dos puntos.
 */
const TAP_GUARD_MS = 250

/**
 * Dos cifras con cero a la izquierda.
 * @param {number} value número
 * @returns {string}
 */
function twoDigits(value) {
    return String(value).padStart(2, "0")
}

/**
 * Jugador de muestra en forma de jugada de plantilla. Acepta objetos o filas [dorsal, nombre,
 * marcas], donde las marcas son "c" (capitán) y "l" (líbero).
 * @param {object|Array} entry jugador
 * @returns {object}
 */
function demoPlayer(entry) {
    if (!Array.isArray(entry)) {
        return { ...entry, shirt: String(entry.shirt) }
    }
    const [shirt, name, marks = ""] = entry
    const player = { shirt: String(shirt), name }
    if (marks.includes("c")) {
        player.captain = true
    }
    if (marks.includes("l")) {
        player.libero = true
    }
    return player
}

/**
 * Miembro del cuerpo técnico de muestra. Acepta objetos o filas [rol, nombre].
 * @param {object|Array} entry miembro
 * @returns {{role: string, name: string}}
 */
function demoStaff(entry) {
    if (!Array.isArray(entry)) {
        return { ...entry }
    }
    return { role: entry[0], name: entry[1] }
}

/**
 * Mantiene el acta abierta, su partido y los borradores de plantilla. Cada cambio se guarda en
 * el almacén y se anuncia por el bus; la sesión no pinta ni toca la URL, eso lo hace quien
 * escucha "record:opened", "record:left" y "render".
 *
 * El partido se reconstruye de forma perezosa: cualquier cambio en el acta lo marca como
 * caducado y el siguiente acceso a match lo vuelve a calcular. Si el motor no sabe abrir el
 * acta, el error salta al leer match, dentro del pintado, y acaba en la pantalla de error.
 */
export class Session {
    #store
    #bus
    #rules
    #notifier
    #demo
    #match = null
    #stale = true

    /** @type {object|null} acta abierta */
    record = null
    /** viendo el acta para imprimir; no se guarda */
    paperMode = false
    /** formato de la vista de impresión; se mantiene al cambiar de acta */
    paperStyle = "official"
    /** plantillas en edición, aún no confirmadas */
    drafts = { home: null, away: null }
    /** instante del último punto aceptado, para el filtro de doble toque */
    lastRallyAt = 0

    /**
     * Recibe sus dependencias ya creadas.
     * @param {{store: RecordStore, bus: Bus, rules: object, notifier: Notifier,
     *     demo?: object}} deps almacén, bus, motor, avisos y, para pruebas, otras plantillas de
     *     muestra
     */
    constructor({ store, bus, rules, notifier, demo = DEMO_ROSTERS }) {
        this.#store = store
        this.#bus = bus
        this.#rules = rules
        this.#notifier = notifier
        this.#demo = demo
    }

    /**
     * Partido reconstruido a partir del acta, o null sin acta.
     * @returns {Match|null}
     */
    get match() {
        if (this.record === null) {
            return null
        }
        if (this.#stale) {
            const { settings, info, plays } = this.record
            this.#match = this.#rules.replay(settings, info, plays)
            this.#stale = false
        }
        return this.#match
    }

    /**
     * Marca el partido como caducado. El router lo llama al empezar cada pintado, porque las
     * pantallas de datos cambian el acta sin pasar por commit.
     */
    invalidate() {
        this.#stale = true
    }

    /**
     * Crea y abre un acta nueva con los datos dados y los ajustes que les corresponden.
     * @param {object} info datos iniciales
     */
    create(info) {
        const record = createRecord(info, initialSettings(info), this.#store.newId())
        this.#adopt(record)
    }

    /**
     * Crea y abre un partido de prueba con plantillas de muestra, directamente en el sorteo. Si
     * el motor rechaza alguna plantilla avisa y no abre nada.
     */
    createDemo() {
        const now = new Date()
        const month = twoDigits(now.getMonth() + 1)
        const info = {
            ...DEMO_INFO,
            date: `${now.getFullYear()}-${month}-${twoDigits(now.getDate())}`,
            time: `${twoDigits(now.getHours())}:${twoDigits(now.getMinutes())}`,
            homeName: this.#demo.home.name,
            awayName: this.#demo.away.name,
        }
        const plays = []
        for (const side of ["home", "away"]) {
            const squad = this.#demo[side]
            plays.push({
                kind: "roster",
                side,
                name: squad.name,
                players: squad.players.map(demoPlayer),
                staff: squad.staff.map(demoStaff),
            })
        }
        const settings = initialSettings({})
        const refusal = this.#rules.check(settings, info, [plays[0]], plays[1])
            || this.#rules.check(settings, info, [], plays[0])
        if (refusal) {
            this.#notifier.show(refusal)
            return
        }
        const record = createRecord(info, settings, this.#store.newId())
        record.createdAt = now.toISOString()
        record.plays = plays
        record.stage = "toss"
        record.demo = true
        this.#adopt(record)
        this.#notifier.show(UI_TEXT.demoReady, { good: true })
    }

    /**
     * Abre un acta guardada. Si no existe, el acta abierta se cierra igualmente y solo se
     * avisa: no se repinta.
     * @param {string} id identificador
     * @returns {boolean} si existía
     */
    open(id) {
        this.#resetView()
        this.record = this.#store.load(id)
        this.#stale = true
        if (this.record === null) {
            this.#match = null
            this.#notifier.show(UI_TEXT.missingRecord)
            return false
        }
        this.#bus.emit("record:opened", { record: this.record })
        return true
    }

    /**
     * Cierra el acta abierta y vuelve a la lista.
     */
    leave() {
        this.record = null
        this.#match = null
        this.#stale = true
        this.#resetView()
        this.#bus.emit("record:left")
    }

    /**
     * Valida, añade y guarda una jugada. Por orden: filtro de doble toque en los puntos, acta
     * cerrada (salvo firmas, que se admiten como en papel), validación con el motor y, por
     * último, el alta. El estado previo (salidas automáticas y capitanes por designar) viaja
     * en "play:committed" para que los avisos sepan qué ha cambiado.
     * @param {object} play jugada
     * @param {{quiet?: boolean}} [options] sin aviso visible del rechazo
     * @returns {string|null} null si se aceptó; si no, el motivo o "double-tap"
     */
    commit(play, { quiet = false } = {}) {
        if (play.kind === "rally" && this.#isDoubleTap()) {
            this.#notifier.show(UI_TEXT.doubleTap)
            return "double-tap"
        }
        const record = this.record
        if (record.sealed && play.kind !== "sign") {
            if (!quiet) {
                this.#notifier.show(SEALED_TEXT)
            }
            return SEALED_TEXT
        }
        const stamped = { ...play, at: play.at || new Date().toISOString() }
        const refusal = this.#rules.check(record.settings, record.info, record.plays, stamped)
        if (refusal) {
            if (!quiet) {
                this.#notifier.show(refusal)
            }
            this.#bus.emit("play:refused", { text: refusal })
            return refusal
        }
        const before = this.#snapshot()
        record.plays.push(stamped)
        this.#persist()
        this.#stale = true
        this.#bus.emit("render")
        this.#bus.emit("play:committed", { play: stamped, ...before })
        return null
    }

    /**
     * Añade varias jugadas como una sola operación, todas con la misma hora. Se valida la
     * secuencia entera, cada jugada sobre las anteriores, y solo después se guarda.
     * @param {object[]} plays jugadas
     * @returns {string|null} null si se aceptaron; si no, el primer motivo de rechazo
     */
    commitBatch(plays) {
        const record = this.record
        const at = new Date().toISOString()
        const trial = [...record.plays]
        for (const play of plays) {
            const stamped = { ...play, at }
            const refusal = this.#rules.check(record.settings, record.info, trial, stamped)
            if (refusal) {
                this.#notifier.show(refusal)
                return refusal
            }
            trial.push(stamped)
        }
        record.plays = trial
        this.#persist()
        this.#stale = true
        this.#bus.emit("render")
        return null
    }

    /**
     * Quita la última jugada deshacible, tras confirmarlo, y deja constancia en las
     * correcciones con el marcador previo. Deshacer un inicio de set se lleva también el
     * sorteo y las formaciones que se confirmaron con él.
     * @returns {string|null} null si se deshizo o se canceló; si no, el motivo
     */
    undo() {
        const record = this.record
        if (record.sealed) {
            this.#notifier.show(SEALED_TEXT)
            return SEALED_TEXT
        }
        const match = this.match
        const last = record.plays.findLast((play) => !NOT_UNDOABLE.has(play.kind))
        if (last === undefined || match.phase === "setup") {
            this.#notifier.show(UI_TEXT.nothingToUndo)
            return UI_TEXT.nothingToUndo
        }
        const end = record.plays.lastIndexOf(last)
        let start = end
        if (last.kind === "startPeriod") {
            while (start > 0 && SET_START_PARTS.has(record.plays[start - 1].kind)) {
                start -= 1
            }
        }
        const label = describePlay(last, match)
        if (!ask(UI_TEXT.askUndo(label))) {
            return null
        }
        this.#amend(this.#scoreNote(label, { playAt: last.at || null }))
        record.plays.splice(start, end - start + 1)
        this.#persist()
        this.#stale = true
        this.#bus.emit("render")
        this.#notifier.show(UI_TEXT.undone(label), { good: true })
        return null
    }

    /**
     * Aprueba y cierra el acta. Las claves y la confirmación las pide la pantalla.
     */
    seal() {
        this.record.sealed = { at: new Date().toISOString() }
        this.#persist()
        this.#bus.emit("render")
        this.#notifier.show(UI_TEXT.sealed, { good: true })
    }

    /**
     * Reabre un acta cerrada con la clave del primer árbitro. La reapertura queda en las
     * correcciones con la hora a la que se había aprobado. Cerrar el diálogo de la clave es cosa
     * de quien llama, cuando recibe null.
     * @param {string} pin clave
     * @returns {string|null} null si se reabrió; si no, el motivo
     */
    reopen(pin) {
        if (pin !== SEAL_PIN) {
            this.#notifier.show(UI_TEXT.wrongReopenPin)
            return UI_TEXT.wrongReopenPin
        }
        const record = this.record
        this.#amend(this.#scoreNote(UI_TEXT.reopenNote(clockTime(record.sealed.at))))
        delete record.sealed
        this.#persist()
        this.#bus.emit("render")
        this.#notifier.show(UI_TEXT.reopened, { good: true })
        return null
    }

    /**
     * Abre un acta recién creada: la guarda y la anuncia.
     * @param {object} record acta
     */
    #adopt(record) {
        this.record = record
        this.#match = null
        this.#stale = true
        this.#resetView()
        this.#persist()
        this.#bus.emit("record:opened", { record })
    }

    /**
     * Nada de lo que se está viendo o editando de un acta pasa a la siguiente.
     */
    #resetView() {
        this.drafts = { home: null, away: null }
        this.paperMode = false
    }

    /**
     * Guarda el acta y avisa si el almacenamiento falla.
     */
    #persist() {
        if (!this.#store.save(this.record)) {
            this.#notifier.show(UI_TEXT.saveFailed)
        }
    }

    /**
     * Comprueba el doble toque y, si no lo es, apunta la hora del punto.
     * @returns {boolean}
     */
    #isDoubleTap() {
        const now = Date.now()
        const guard = globalThis.empatTapGuardMs ?? TAP_GUARD_MS
        if (now - this.lastRallyAt < guard) {
            return true
        }
        this.lastRallyAt = now
        return false
    }

    /**
     * Lo que hay que recordar al añadir una jugada para saber después qué cambió.
     * @returns {{autoBefore: number, captainBefore: {home: boolean, away: boolean}}}
     */
    #snapshot() {
        const match = this.match
        const rules = this.#rules
        return {
            autoBefore: match?.automatic.length ?? 0,
            captainBefore: {
                home: Boolean(match) && rules.needsActingCaptain(match, "home"),
                away: Boolean(match) && rules.needsActingCaptain(match, "away"),
            },
        }
    }

    /**
     * Corrección con la hora actual, el periodo en curso y su marcador.
     * @param {string} text texto de la corrección
     * @param {object} [extra] campos que van entre el texto y el periodo
     * @returns {object}
     */
    #scoreNote(text, extra = {}) {
        const period = this.#rules.currentPeriod(this.match)
        return {
            at: new Date().toISOString(),
            text,
            ...extra,
            period: period.number,
            home: period.score.home,
            away: period.score.away,
        }
    }

    /**
     * Añade una corrección al acta.
     * @param {object} amendment corrección
     */
    #amend(amendment) {
        this.record.amendments ??= []
        this.record.amendments.push(amendment)
    }
}
