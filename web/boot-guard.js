/**
 * Vigilancia de arranque. Es un script clásico que se carga bloqueando en <head>, por delante de
 * los módulos, para enterarse de cualquier fallo de carga. Si pasado el plazo la aplicación no ha
 * pintado nada (window.empatBooted sigue sin ponerse), sustituye el contenido de #stage por un
 * aviso con el detalle de los fallos y un botón que vacía las cachés y recarga.
 *
 * No importa nada: si el grafo de módulos se rompe, el traductor tampoco llega a arrancar, así
 * que este archivo trae sus propios textos en castellano y en catalán.
 * @file boot-guard.js
 */

/** Plazo para que la aplicación pinte; vencido, el arranque se da por fallido. */
const GUARD_WAIT_MS = 10000

/** Cuántos fallos se enseñan como mucho. */
const GUARD_SHOWN_FAILURES = 4

/** Clave donde se guarda el idioma elegido a mano. */
const GUARD_LANGUAGE_KEY = "empat/lengua"

/**
 * Textos del aviso por idioma. Cada frase catalana es la misma que da el catálogo de la
 * aplicación para la castellana: así el aviso se ve igual lo pinte este archivo o lo traduzca el
 * observador de idioma.
 */
const GUARD_WORDING = {
    es: {
        heading: "La aplicación no ha podido arrancar",
        safe: "No se ha perdido nada: las actas siguen en el dispositivo.",
        failures: "Detalle del error: ",
        silent: "Detalle del error: el programa del acta no ha llegado a ponerse en marcha (puede que lo bloquee el navegador o alguna extensión).",
        missing: "Falta un archivo: ",
        browser: "Navegador: ",
        retry: "Recargar desde cero",
        subtitle: "Acta electrónica de voleibol",
    },
    ca: {
        heading: "L'aplicació no ha pogut arrencar",
        safe: "No s'ha perdut res: les actes continuen al dispositiu.",
        failures: "Detall de l'error: ",
        silent: "Detall de l'error: el programa de l'acta no s'ha arribat a posar en marxa (potser el bloqueja el navegador o alguna extensió).",
        missing: "Falta un fitxer: ",
        browser: "Navegador: ",
        retry: "Recarrega des de zero",
        subtitle: "Acta electrònica de voleibol",
    },
}

/** Equivalencias para escribir texto dentro del marcado. */
const GUARD_ENTITIES = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;",
}

/**
 * Fallos recogidos mientras la página arranca: la dirección del recurso que no ha cargado o el
 * texto del error. Se pasan a palabras al pintar el aviso, ya con el idioma decidido.
 */
const guardFailures = []

/**
 * Idioma en que se escribe el aviso. Se elige como lo hace la aplicación (lo guardado y, si no
 * hay nada, el idioma del navegador), con una salvedad: si <html lang> ya dice "ca" es que el
 * módulo de idioma arrancó y su observador traducirá lo que se escriba, de modo que se escribe
 * en castellano para no traducir dos veces.
 * @returns {"es"|"ca"} juego de textos que hay que usar
 */
function guardLanguage() {
    let chosen = ""
    try {
        chosen = localStorage.getItem(GUARD_LANGUAGE_KEY) || ""
    } catch (error) {
        return "es"
    }
    if (!chosen) {
        const browser = String(navigator.language || "").toLowerCase()
        if (browser.startsWith("ca")) {
            chosen = "ca"
        }
    }
    if (chosen !== "ca") {
        return "es"
    }
    if (document.documentElement.lang === "ca") {
        return "es"
    }
    return "ca"
}

/**
 * Escapa un texto para meterlo en el marcado del aviso.
 * @param {unknown} value cualquier valor
 * @returns {string} texto seguro
 */
function guardEscape(value) {
    return String(value).replace(/[&<>"']/g, (char) => GUARD_ENTITIES[char])
}

/**
 * Resume un evento de error. Un recurso que no carga (script, hoja de estilo, imagen) da su
 * dirección; un error de código, su mensaje con archivo y línea.
 * @param {ErrorEvent|Event} event evento capturado en window
 * @returns {{address?: string, text?: string}} dirección del recurso o texto del error
 */
function describeFailure(event) {
    const target = event.target
    let address = ""
    if (target && target !== window) {
        address = target.src || target.href || ""
    }
    if (address) {
        return { address }
    }
    let text = event.message || "Error"
    if (event.filename) {
        text += " (" + event.filename.split("/").pop() + ":" + event.lineno + ")"
    }
    return { text }
}

/**
 * Apunta un error o un recurso que no ha cargado. Escucha en captura porque los fallos de carga
 * de un elemento no suben hasta window.
 * @param {ErrorEvent|Event} event evento de error
 */
function noteFailure(event) {
    guardFailures.push(describeFailure(event))
}

/**
 * Apunta una promesa rechazada que nadie ha atendido.
 * @param {PromiseRejectionEvent} event evento de rechazo
 */
function noteRejection(event) {
    const reason = event.reason
    let text = reason
    if (reason && reason.message) {
        text = reason.message
    }
    guardFailures.push({ text: "Promesa: " + text })
}

/**
 * Marcado del aviso con los textos del idioma pedido.
 * @param {typeof GUARD_WORDING.es} words textos
 * @returns {string} HTML del aviso
 */
function guardMarkup(words) {
    let detail = words.silent
    if (guardFailures.length > 0) {
        const shown = guardFailures.slice(0, GUARD_SHOWN_FAILURES).map((failure) => {
            const line = failure.address ? words.missing + failure.address : failure.text
            return guardEscape(line)
        })
        detail = words.failures + shown.join(" · ")
    }
    return "<section class=\"panel\" role=\"alert\"><h2>" + words.heading + "</h2>" +
        "<p>" + words.safe + "</p>" +
        "<p class=\"fine dim\">" + detail + "</p>" +
        "<p class=\"fine dim\">" + words.browser + guardEscape(navigator.userAgent) + "</p>" +
        "<div class=\"hstack\"><button class=\"cta\" id=\"guard-reload\">" + words.retry +
        "</button></div></section>"
}

/**
 * Vacía todas las cachés de la web y pide a los service workers que busquen versión nueva; luego
 * recarga, salga bien o mal, porque lo que importa es volver a intentarlo.
 */
function reloadWithoutCache() {
    const reload = () => location.reload()
    try {
        const chores = [0, 0]
        if (window.caches) {
            chores[0] = caches.keys().then(dropCaches)
        }
        if (navigator.serviceWorker) {
            chores[1] = navigator.serviceWorker.getRegistrations().then(refreshWorkers)
        }
        Promise.all(chores).then(reload, reload)
    } catch (error) {
        reload()
    }
}

/**
 * Borra las cachés indicadas.
 * @param {string[]} names nombres de caché
 * @returns {Promise<boolean[]>}
 */
function dropCaches(names) {
    return Promise.all(names.map((name) => caches.delete(name)))
}

/**
 * Pide a cada registro de service worker que compruebe si hay versión nueva.
 * @param {ServiceWorkerRegistration[]} registrations registros
 * @returns {Promise<unknown[]>}
 */
function refreshWorkers(registrations) {
    return Promise.all(registrations.map((registration) => registration.update()))
}

/**
 * Pone en catalán lo que el observador de idioma habría traducido en la cabecera: el idioma del
 * documento y el subtítulo fijo. Solo se llama cuando ese observador no llegó a arrancar.
 */
function translateHeader() {
    document.documentElement.lang = "ca"
    const subtitle = document.getElementById("subtitle")
    if (subtitle && subtitle.textContent === GUARD_WORDING.es.subtitle) {
        subtitle.textContent = GUARD_WORDING.ca.subtitle
    }
}

/**
 * Se ejecuta al vencer el plazo. Si la aplicación ya pintó, o la página no tiene escenario, no
 * hace nada.
 */
function judgeBoot() {
    if (window.empatBooted) {
        return
    }
    const stage = document.getElementById("stage")
    if (!stage) {
        return
    }
    const language = guardLanguage()
    stage.innerHTML = guardMarkup(GUARD_WORDING[language])
    if (language === "ca") {
        translateHeader()
    }
    document.getElementById("guard-reload").addEventListener("click", reloadWithoutCache)
}

/**
 * Pone en marcha la vigilancia: escucha fallos desde ya y programa el veredicto.
 */
function startBootGuard() {
    window.addEventListener("error", noteFailure, true)
    window.addEventListener("unhandledrejection", noteRejection)
    setTimeout(judgeBoot, GUARD_WAIT_MS)
}

startBootGuard()
