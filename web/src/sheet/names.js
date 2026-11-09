/**
 * Nombres de personas tal como se escriben en el acta: apellido delante y en mayúsculas para
 * árbitros y oficiales, y solo el apellido (con lo justo para distinguir) en las plantillas.
 * @module src/sheet/names.js
 */

/**
 * Palabras cortas que no son apellido por sí solas y se unen a la palabra que las sigue
 * ("de la Fuente" es un único apellido).
 */
const PARTICLES = new Set(`de del la las los les el i y da dos van von di`.split(" "))

/**
 * Agrupa las palabras de los apellidos uniendo cada partícula con la palabra siguiente. Las
 * partículas sueltas al final forman un apellido propio.
 * @param {string[]} words palabras tras el nombre de pila
 * @returns {string[]}
 */
function groupSurnames(words) {
    const surnames = []
    let pending = []
    for (const word of words) {
        if (!word) {
            continue
        }
        pending.push(word)
        if (!PARTICLES.has(word.toLowerCase())) {
            surnames.push(pending.join(" "))
            pending = []
        }
    }
    if (pending.length > 0) {
        surnames.push(pending.join(" "))
    }
    return surnames
}

/**
 * Separa un nombre completo en nombre de pila y apellidos. Acepta "Nombre Apellido1
 * Apellido2" (la primera palabra es el nombre) y "Apellidos, Nombre" (manda la coma). Una
 * sola palabra sin coma se toma como apellido.
 * @param {unknown} fullName nombre tal como se escribió
 * @returns {{given: string, surnames: string[]}}
 */
function splitName(fullName) {
    const clean = String(fullName || "").trim().replace(/\s+/g, " ")
    if (!clean) {
        return { given: "", surnames: [] }
    }
    if (clean.includes(",")) {
        const pieces = clean.split(",")
        const given = (pieces[1] || "").trim()
        return { given, surnames: groupSurnames(pieces[0].trim().split(" ")) }
    }
    const words = clean.split(" ")
    if (words.length === 1) {
        return { given: "", surnames: groupSurnames(words) }
    }
    return { given: words[0], surnames: groupSurnames(words.slice(1)) }
}

/**
 * Forma "APELLIDO, NOMBRE" para árbitros, anotador y oficiales: solo el primer apellido. Sin
 * apellido queda el nombre; sin nombre, el apellido solo.
 * @param {unknown} fullName nombre completo
 * @returns {string} en mayúsculas
 */
export function surnameFirst(fullName) {
    const { given, surnames } = splitName(fullName)
    if (surnames.length === 0) {
        return given.toUpperCase()
    }
    if (!given) {
        return surnames[0].toUpperCase()
    }
    return `${surnames[0]}, ${given}`.toUpperCase()
}

/**
 * Clave de comparación de apellidos: sin tildes ni mayúsculas.
 * @param {unknown} text texto
 * @returns {string}
 */
function foldKey(text) {
    return String(text || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
}

/**
 * Abrevia la última palabra de unos apellidos a su inicial con punto: "Garcia Puig" da
 * "Garcia P.". Vacío si no hay apellidos.
 * @param {string} surnames apellidos separados por un espacio
 * @returns {string}
 */
function initialOfLast(surnames) {
    if (!surnames) {
        return ""
    }
    const cut = surnames.lastIndexOf(" ") + 1
    return surnames.slice(0, cut) + surnames[cut] + "."
}

/**
 * Prepara las etiquetas de una plantilla. Cada jugador sale con su primer apellido; cuando
 * varios lo comparten se añade lo mínimo para distinguirlos: la inicial del segundo apellido,
 * el segundo apellido entero si las iniciales también coinciden, o los dos apellidos y la
 * inicial del nombre si el segundo tampoco basta.
 * @param {{name?: string}[]} players jugadores de un equipo; las etiquetas dependen de todos
 * @returns {(player: object) => string} da la etiqueta de cualquiera de esos jugadores
 */
export function rosterSurnames(players) {
    const parsed = new Map()
    for (const player of players) {
        parsed.set(player, splitName(player.name))
    }
    const secondOf = (player) => parsed.get(player).surnames.slice(1).join(" ")
    return function labelFor(player) {
        const { given, surnames } = parsed.get(player)
        const firstKey = foldKey(surnames[0])
        const firstOf = (other) => foldKey(parsed.get(other).surnames[0])
        const namesakes = players.filter((other) => firstOf(other) === firstKey)
        if (namesakes.length < 2) {
            return surnames[0] || given
        }
        const second = secondOf(player)
        const secondKey = foldKey(second)
        const twins = namesakes.filter((other) => foldKey(secondOf(other)) === secondKey)
        if (second && twins.length < 2) {
            const initialKey = foldKey(initialOfLast(second))
            const initialOf = (other) => foldKey(initialOfLast(secondOf(other)))
            const others = namesakes.filter((other) => other !== player)
            const clash = others.some((other) => initialOf(other) === initialKey)
            if (clash) {
                return `${surnames[0]} ${second}`
            }
            return `${surnames[0]} ${initialOfLast(second)}`
        }
        const family = [surnames[0], second].filter(Boolean).join(" ")
        if (!given) {
            return family
        }
        return `${family}, ${given[0]}.`
    }
}
