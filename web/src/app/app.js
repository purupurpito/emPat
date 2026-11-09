/**
 * Raíz de la interfaz: crea los servicios compartidos y los conecta entre sí.
 * @module src/app/app.js
 */

import * as rules from "../rules/index.js"
import { Bus } from "./bus.js"
import { RecordStore } from "./store.js"
import { Session } from "./session.js"
import { Router } from "./router.js"
import { DialogHost } from "./dialog.js"
import { Notifier } from "./notifier.js"
import { installShortcuts } from "./keyboard.js"
import { installNotices } from "./notices.js"
import { Countdown, Ticker, WakeGuard } from "./clocks.js"
import { setFatalContext } from "./screens/fatal.screen.js"

/**
 * Contenedor de la aplicación: bus, almacén, sesión, router, diálogo, avisos y relojes. No
 * pinta nada por sí mismo; delega en el router. Las pantallas y diálogos reciben esta
 * instancia y llegan a todo a través de ella.
 */
export class App {
    /**
     * Crea y enlaza los servicios.
     */
    constructor() {
        /** si ya hubo un primer pintado (o la pantalla de error) */
        this.booted = false
        this.rules = rules
        this.bus = new Bus()
        this.store = new RecordStore()
        this.notifier = new Notifier()
        this.ticker = new Ticker()
        this.countdown = new Countdown()
        this.wake = new WakeGuard()
        this.dialog = new DialogHost({ countdown: this.countdown, bus: this.bus })
        this.session = new Session({
            store: this.store,
            bus: this.bus,
            rules,
            notifier: this.notifier,
        })
        this.router = new Router(this)
        setFatalContext(this)
        this.#wire()
    }

    /**
     * Abre el acta indicada (si existe) o pinta la portada. Si el acta pedida no existe solo se
     * avisa, sin pintar nada.
     * @param {string|null} recordId identificador recibido en la URL
     */
    start(recordId) {
        if (recordId) {
            this.session.open(recordId)
            return
        }
        this.router.render()
    }

    /**
     * Conecta los temas del bus con el router y la dirección, e instala teclado, avisos,
     * cierre de diálogos y el bloqueo de pantalla al volver a la página.
     */
    #wire() {
        const bus = this.bus
        bus.on("render", () => this.router.render())
        bus.on("record:opened", ({ record }) => {
            history.replaceState(null, "", "?acta=" + record.id)
            this.router.render()
            scrollTo(0, 0)
        })
        bus.on("record:left", () => {
            history.replaceState(null, "", location.pathname)
            this.router.render()
        })
        this.dialog.install()
        installShortcuts(this)
        installNotices(this)
        document.addEventListener("visibilitychange", () => this.#rewake())
    }

    /**
     * Vuelve a pedir la pantalla encendida al regresar a la página durante un set: el navegador
     * suelta el bloqueo al esconderla.
     */
    #rewake() {
        if (document.visibilityState !== "visible") {
            return
        }
        let phase = null
        try {
            phase = this.session.match?.phase ?? null
        } catch {
            // Un acta que no se puede reconstruir ya está en la pantalla de error.
        }
        if (phase === "live") {
            this.wake.hold()
        }
    }
}
