/**
 * Registro del service worker y banner de actualización (#upd).
 *
 * La primera instalación solo informa de que la web ya funciona sin conexión. Cuando llega una
 * versión nueva, el banner ofrece un botón para pasar a ella; la página no se recarga nunca por
 * su cuenta, porque el anotador puede estar en mitad de un punto. Los textos se escriben en
 * castellano y, en catalán, los traduce el observador de idioma al entrar en el DOM.
 *
 * No importa nada de la aplicación: si otro módulo falla al cargar, el registro tiene que seguir
 * funcionando para que la siguiente visita pueda recibir el arreglo.
 * @module src/pwa/updates.js
 */

/** Aviso de la primera instalación. */
const READY_OFFLINE = "Listo: emPat ya se puede usar sin conexión."

/** Aviso de versión nueva esperando. */
const NEW_VERSION = "Nueva versión de emPat disponible."

/** Orden que entiende sw.js para activar la versión que espera. */
const ACTIVATE_NOW = "activate-now"

/**
 * Banner de actualización y lo que recuerda entre eventos.
 */
class UpdateBanner {
    #box = document.getElementById("upd")
    #text = document.getElementById("upd-text")
    #button = document.getElementById("upd-go")
    #waiting = null
    #accepted = false
    #hadController

    /**
     * @param {ServiceWorkerContainer} container navigator.serviceWorker
     */
    constructor(container) {
        this.#hadController = Boolean(container.controller)
        const close = document.getElementById("upd-close")
        close.addEventListener("click", () => this.#box.classList.add("is-hidden"))
        this.#button.addEventListener("click", () => this.#accept())
        container.addEventListener("controllerchange", () => this.#maybeReload())
    }

    /**
     * Enseña el banner con un texto y, si se pide, con el botón de actualizar.
     * @param {string} text aviso
     * @param {boolean} withButton si lleva botón
     */
    #show(text, withButton) {
        this.#text.textContent = text
        this.#button.classList.toggle("is-hidden", !withButton)
        this.#box.classList.remove("is-hidden")
    }

    /**
     * Ofrece pasar a un worker ya instalado que espera turno.
     * @param {ServiceWorker} worker versión nueva
     */
    offer(worker) {
        this.#waiting = worker
        this.#show(NEW_VERSION, true)
    }

    /**
     * Sigue a un worker que se está instalando. Al quedar instalado, si ya había otro al mando es
     * una versión nueva; si no, es la primera instalación.
     * @param {ServiceWorker|null} worker worker en instalación
     */
    follow(worker) {
        worker.addEventListener("statechange", () => {
            if (worker.state !== "installed") {
                return
            }
            if (this.#hadController) {
                this.offer(worker)
                return
            }
            this.#show(READY_OFFLINE, false)
        })
    }

    /**
     * ¿Había ya un worker controlando la página al cargarla?
     * @returns {boolean}
     */
    get hadController() {
        return this.#hadController
    }

    /** El anotador ha pulsado Actualizar: se activa la versión que espera. */
    #accept() {
        if (this.#waiting === null) {
            return
        }
        this.#accepted = true
        this.#waiting.postMessage(ACTIVATE_NOW)
    }

    /** Cambio de worker al mando: solo recarga si lo ha pedido el anotador. */
    #maybeReload() {
        if (this.#accepted) {
            location.reload()
        }
    }
}

/**
 * Registra sw.js y conecta el banner con sus eventos.
 * @param {ServiceWorkerContainer} container navigator.serviceWorker
 * @param {UpdateBanner} banner banner
 * @returns {Promise<void>}
 */
async function register(container, banner) {
    const registration = await container.register("sw.js")
    if (registration.waiting && banner.hadController) {
        banner.offer(registration.waiting)
    }
    if (registration.installing) {
        banner.follow(registration.installing)
    }
    registration.addEventListener("updatefound", () => banner.follow(registration.installing))
}

/**
 * Pone en marcha el servicio sin conexión cuando la página termina de cargar. No hace nada si la
 * página se abre como archivo local o si el navegador no tiene service workers. Cualquier fallo
 * del registro se ignora: la aplicación sigue funcionando, solo que sin caché.
 * @returns {boolean} si se ha programado el registro
 */
export function watchForUpdates() {
    if (!("serviceWorker" in navigator)) {
        return false
    }
    if (location.protocol === "file:") {
        return false
    }
    const container = navigator.serviceWorker
    const banner = new UpdateBanner(container)
    addEventListener("load", () => {
        register(container, banner).catch(() => {})
    })
    return true
}

if (typeof document !== "undefined") {
    watchForUpdates()
}
