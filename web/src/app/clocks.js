/**
 * Relojes de la interfaz: el pulso compartido, la cuenta atrás y el bloqueo de pantalla.
 * @module src/app/clocks.js
 */

/**
 * Pulso periódico único, compartido por el reloj del set y el intervalo entre sets. Programar
 * uno nuevo cancela el anterior, así nunca quedan dos relojes escribiendo en la pantalla.
 */
export class Ticker {
    #handle = null

    /**
     * Ejecuta la función ya y después cada periodo, sustituyendo al pulso anterior.
     * @param {number} ms periodo
     * @param {() => void} tick función
     */
    every(ms, tick) {
        this.stop()
        tick()
        this.#handle = setInterval(tick, ms)
    }

    /**
     * Detiene el pulso. No pasa nada si no había ninguno.
     */
    stop() {
        if (this.#handle !== null) {
            clearInterval(this.#handle)
            this.#handle = null
        }
    }
}

/**
 * Cuenta atrás en segundos para los tiempos de descanso. Se refresca cuatro veces por segundo
 * para que la barra avance suave; el número mostrado se redondea hacia arriba.
 */
export class Countdown {
    #handle = null

    /**
     * Empieza la cuenta, cancelando la anterior. onTick recibe los segundos que quedan y la
     * fracción de tiempo pendiente (puede bajar de cero en el último pulso). Si onTick devuelve
     * false la cuenta se detiene sin llamar a onEnd: es la forma de pararla cuando su diálogo se
     * ha cerrado por otro camino.
     * @param {number} seconds duración
     * @param {(left: number, fraction: number) => (boolean|void)} onTick en cada pulso
     * @param {() => void} onEnd al llegar a cero
     */
    start(seconds, onTick, onEnd) {
        this.stop()
        const total = seconds * 1000
        const deadline = Date.now() + total
        let finished = false
        const pulse = () => {
            const remaining = deadline - Date.now()
            const left = Math.max(0, Math.ceil(remaining / 1000))
            if (onTick(left, remaining / total) === false) {
                finished = true
                this.stop()
                return
            }
            if (left <= 0) {
                finished = true
                this.stop()
                onEnd()
            }
        }
        pulse()
        if (!finished) {
            this.#handle = setInterval(pulse, 250)
        }
    }

    /**
     * Detiene la cuenta.
     */
    stop() {
        if (this.#handle !== null) {
            clearInterval(this.#handle)
            this.#handle = null
        }
    }
}

/**
 * Mantiene la pantalla encendida durante el partido si el navegador lo permite. Los fallos se
 * ignoran: sin bloqueo la aplicación funciona igual.
 */
export class WakeGuard {
    #sentinel = null

    /**
     * Pide mantener la pantalla encendida, solo si la página está a la vista y aún no se tiene.
     * @returns {Promise<void>}
     */
    async hold() {
        if (this.#sentinel !== null) {
            return
        }
        if (!("wakeLock" in navigator) || document.visibilityState !== "visible") {
            return
        }
        try {
            const sentinel = await navigator.wakeLock.request("screen")
            this.#sentinel = sentinel
            sentinel.addEventListener("release", () => {
                this.#sentinel = null
            })
        } catch {
            this.#sentinel = null
        }
    }

    /**
     * Suelta el bloqueo si lo había.
     * @returns {Promise<void>}
     */
    async release() {
        const sentinel = this.#sentinel
        if (sentinel === null) {
            return
        }
        try {
            await sentinel.release()
        } catch {
            // El navegador ya lo había soltado; da igual.
        }
        this.#sentinel = null
    }
}
