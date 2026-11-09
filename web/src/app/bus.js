/**
 * Canal de eventos síncrono entre la sesión, el router y los avisos.
 *
 * Temas en uso: "record:opened" {record}, "record:left", "play:committed" {play, autoBefore,
 * captainBefore}, "play:refused" {text}, "render", "dialog:closed" y "paper:toggled" {on}.
 * @module src/app/bus.js
 */

/**
 * Publicación y suscripción por tema. Los oyentes se llaman en orden de alta y de forma
 * síncrona: quien emite sabe que, al volver, todos han reaccionado. Por eso la sesión puede
 * emitir "render" y justo después "play:committed" contando con la pantalla ya repintada.
 */
export class Bus {
    #topics = new Map()

    /**
     * Suscribe un oyente a un tema.
     * @param {string} topic tema
     * @param {(payload: any) => void} listener oyente
     * @returns {() => void} función que da de baja
     */
    on(topic, listener) {
        let listeners = this.#topics.get(topic)
        if (listeners === undefined) {
            listeners = []
            this.#topics.set(topic, listeners)
        }
        listeners.push(listener)
        return () => {
            const index = listeners.indexOf(listener)
            if (index !== -1) {
                listeners.splice(index, 1)
            }
        }
    }

    /**
     * Avisa a todos los oyentes de un tema. Se recorre una copia para que un oyente pueda darse
     * de baja durante el aviso sin saltarse al siguiente.
     * @param {string} topic tema
     * @param {any} [payload] datos
     */
    emit(topic, payload) {
        const listeners = this.#topics.get(topic)
        if (listeners === undefined) {
            return
        }
        for (const listener of [...listeners]) {
            listener(payload)
        }
    }
}
