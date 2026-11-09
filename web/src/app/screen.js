/**
 * Base de las pantallas con delegación declarativa de eventos.
 *
 * Cada pantalla declara un mapa estático "tipo selector" → método, por ejemplo
 * { "click [data-open-record]": "openRecord", "submit #details-form": "save" }. Al montarla se
 * pone un solo oyente por tipo en el contenedor, y cada evento se reparte al método cuyo
 * selector encaja con el elemento pulsado o con uno de sus antepasados dentro del contenedor.
 * Los métodos reciben (evento, elemento que encaja). Los diálogos usan el mismo reparto sobre
 * #dlg-body mediante delegate().
 * @module src/app/screen.js
 */

import { byId, focusKey, restoreFocus } from "./dom.js"

/**
 * Separa una clave del mapa de eventos en tipo y selector. Sin selector, el método recibe los
 * eventos de ese tipo que lleguen al contenedor.
 * @param {string} key clave "tipo selector"
 * @returns {{type: string, selector: string}}
 */
function splitKey(key) {
    const trimmed = key.trim()
    const gap = trimmed.search(/\s/)
    if (gap === -1) {
        return { type: trimmed, selector: "" }
    }
    return { type: trimmed.slice(0, gap), selector: trimmed.slice(gap).trim() }
}

/**
 * Agrupa un mapa de eventos por tipo, conservando el orden de declaración.
 * @param {Record<string, string>} events mapa
 * @returns {Map<string, Array<{selector: string, method: string}>>}
 */
function groupByType(events) {
    const groups = new Map()
    for (const [key, method] of Object.entries(events)) {
        const { type, selector } = splitKey(key)
        if (!groups.has(type)) {
            groups.set(type, [])
        }
        groups.get(type).push({ selector, method })
    }
    return groups
}

/**
 * Engancha un mapa de eventos a un contenedor y devuelve la función que lo suelta. El elemento
 * que encaja tiene que estar dentro del contenedor: un closest() que suba más allá no cuenta.
 * @param {HTMLElement} root contenedor
 * @param {Record<string, string>} events mapa "tipo selector" → método
 * @param {object} owner objeto que tiene los métodos
 * @returns {() => void} baja de todos los oyentes
 */
export function delegate(root, events, owner) {
    const removals = []
    for (const [type, routes] of groupByType(events)) {
        const listener = (event) => {
            for (const { selector, method } of routes) {
                const hit = pickTarget(root, event.target, selector)
                if (hit !== null) {
                    owner[method](event, hit)
                }
            }
        }
        root.addEventListener(type, listener)
        removals.push(() => root.removeEventListener(type, listener))
    }
    return () => {
        for (const remove of removals) {
            remove()
        }
    }
}

/**
 * Elemento del evento que encaja con el selector, o null.
 * @param {HTMLElement} root contenedor
 * @param {EventTarget|null} origin elemento donde nació el evento
 * @param {string} selector selector CSS; vacío para el propio contenedor
 * @returns {Element|null}
 */
function pickTarget(root, origin, selector) {
    if (selector === "") {
        return root
    }
    if (!(origin instanceof Element)) {
        return null
    }
    const hit = origin.closest(selector)
    if (hit === null || !root.contains(hit)) {
        return null
    }
    return hit
}

/**
 * Pantalla genérica. Cada subclase declara su mapa de eventos y su vista; la base inserta el
 * marcado y pone un único oyente por tipo de evento en el contenedor. Para lo que no se puede
 * expresar como evento delegado (relojes, foco, enlaces entre desplegables) existe el gancho
 * mounted(), que se llama con el marcado ya insertado.
 */
export class Screen {
    /**
     * Mapa "tipo selector" → nombre de método. Las subclases lo sustituyen.
     * @type {Record<string, string>}
     */
    static events = {}

    #release = null
    #root = null

    /**
     * Guarda la aplicación.
     * @param {App} app aplicación
     */
    constructor(app) {
        this.app = app
    }

    /**
     * Marcado de la pantalla. La base no pinta nada.
     * @returns {string|Markup}
     */
    view() {
        return ""
    }

    /**
     * Contenedor donde está montada, o null.
     * @returns {HTMLElement|null}
     */
    get root() {
        return this.#root
    }

    /**
     * Inserta la vista y engancha los eventos. Sin contenedor usa #stage. Si el foco estaba en
     * un control del contenedor, pasa al control equivalente del marcado nuevo: así, tras una
     * jugada, el teclado sigue en el mismo botón.
     * @param {HTMLElement} [root] contenedor
     */
    mount(root = byId("stage")) {
        this.unmount()
        this.#root = root
        const focused = focusKey(root)
        root.innerHTML = String(this.view())
        this.#release = delegate(root, this.constructor.events, this)
        restoreFocus(root, focused)
        this.mounted()
    }

    /**
     * Gancho tras insertar el marcado. La base no hace nada.
     */
    mounted() {}

    /**
     * Suelta los oyentes. El marcado se queda: lo sustituye quien monte la siguiente pantalla.
     */
    unmount() {
        if (this.#release !== null) {
            this.#release()
            this.#release = null
        }
        this.#root = null
    }
}
