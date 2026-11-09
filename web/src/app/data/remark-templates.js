/**
 * Frases hechas para las observaciones del acta, tal como las recoge la circular federativa de
 * observaciones: el texto catalán es el de la circular y el castellano, su traducción.
 *
 * La tabla se escribe como texto y se analiza una vez al cargar. Cada bloque empieza con una
 * línea "== título [campos] «rótulo»": los campos son los datos que pide el diálogo (team,
 * player, shirts, minutes, count, text) y el rótulo, opcional, nombra la casilla de count o text.
 * Siguen las líneas "es:" y "ca:"; una frase larga continúa en las líneas siguientes con sangría
 * y se une con un espacio.
 *
 * Los huecos entre llaves los rellena el diálogo: {eq} equipo, {jug} jugador, {jugs} dorsales,
 * {min} minutos, {n} cantidad, {txt} texto libre, {tanteo} marcador y {set} ordinal del set en
 * juego.
 * @module src/app/data/remark-templates.js
 */

const SOURCE = `
    == Retraso: partido federado anterior [minutes]
    es: El partido empieza con {min} minutos de retraso debido a un partido de voleibol federado
        anterior.
    ca: El partit comença amb {min} minuts de retard degut a un partit de voleibol federat
        anterior.
    == Retraso: partido escolar anterior [minutes]
    es: El partido empieza con {min} minutos de retraso debido a un partido de voleibol escolar
        anterior.
    ca: El partit comença amb {min} minuts de retard degut a un partit de voleibol escolar
        anterior.
    == Retraso: partido de otro deporte [minutes text] «Deporte»
    es: El partido empieza con {min} minutos de retraso por un partido de {txt}.
    ca: El partit comença amb {min} minuts de retard per un partit de {txt}.
    == Retraso: un equipo llega tarde [minutes team]
    es: El partido empieza con {min} minutos de retraso por la llegada con retraso del equipo
        {eq}.
    ca: El partit comença amb {min} minuts de retard per l'arribada amb retard de l'equip {eq}.
    == CTA-1 de todo el equipo [team]
    es: El equipo {eq} presenta CTA-1 para todos sus componentes por falta de autorización
        federativa.
    ca: L'equip {eq} presenta CTA-1 per a tots els seus components per manca d'autorització
        federativa.
    == CTA-1 de algunos componentes [team count] «Cuántos»
    es: El equipo {eq} presenta CTA-1 de {n} de sus componentes por falta de autorización
        federativa.
    ca: L'equip {eq} presenta CTA-1 de {n} dels seus components per manca d'autorització
        federativa.
    == DNI que no coincide con la autorización [team player]
    es: El equipo {eq} presenta DNI con numeración no coincidente con la que consta en la
        autorización federativa para {jug}.
    ca: L'equip {eq} presenta D.N.I. amb numeració no coincident amb la que consta a
        l'autorització federativa per {jug}.
    == Fotografía por falta de documento [team player]
    es: {jug} del equipo {eq} presenta fotografía por falta de documento identificativo.
    ca: {jug} de l'equip {eq} presenta fotografia per manca de document identificatiu.
    == Inscrito que no se presenta [team player]
    es: {jug} del equipo {eq} no comparece al partido habiendo sido inscrito/a en el acta.
    ca: {jug} de l'equip {eq} no compareix al partit havent estat inscrit/a a l'acta.
    == Abandona el partido [team player]
    es: {jug} del equipo {eq} abandona el partido con el tanteo {tanteo} del {set} set.
    ca: {jug} de l'equip {eq} abandona el partit amb el tanteig {tanteo} del {set} set.
    == Lesión [team player]
    es: {jug} del equipo {eq} se lesiona con el tanteo {tanteo} del {set} set.
    ca: {jug} de l'equip {eq} es lesiona amb el tanteig {tanteo} del {set} set.
    == Lesionado antes del partido [team player]
    es: El equipo {eq} informa antes del encuentro que {jug} está lesionado/a: se inscribe en el
        acta pero no disputará el encuentro.
    ca: L'equip {eq} informa previ a l'encontre que {jug} es troba lesionat/da, s'inscriurà en
        acta però no disputarà l'encontre.
    == Uniformidad: camiseta diferente [team shirts]
    es: Se informa al equipo {eq} de la falta de uniformidad de sus jugadores {jugs}: presentan
        camiseta diferente del resto del equipo.
    ca: S'informa a l'equip {eq} de la manca d'uniformitat dels seus jugadors {jugs}, presenten
        samarreta diferent de la resta de l'equip.
    == Uniformidad: líberos con colores invertidos [team]
    es: Se informa al equipo {eq} de la falta de uniformidad de sus líberos: presentan los
        mismos colores pero invertidos respecto al resto del equipo, lo que dificulta
        identificarlos como tales.
    ca: S'informa a l'equip {eq} de la manca d'uniformitat dels seus lliures, aquests presenten
        els mateixos colors però de manera invertida a la uniformitat de la resta de l'equip,
        presentant dificultat la seva identificació com a tals.
    == Uniformidad: dorsal con esparadrapo [team shirts]
    es: Se informa al equipo {eq} de la falta de uniformidad de sus jugadores {jugs}, que
        presentan su número de camiseta dibujado con esparadrapo.
    ca: S'informa a l'equip {eq} de la manca d'uniformitat dels seus jugadors {jugs} que
        presenten el seu número de samarreta dibuixat amb esparadrap.
    == Protocolo de recogepelotas (Circular 012) []
    es: Ambos equipos acuerdan aplicar el protocolo de recogepelotas durante todo el partido
        (Circular CTARJ 012).
    ca: Ambdós equips acorden aplicar el protocol d'aplega pilotes durant tot el partit
        (Circular CTARJ 012).
    == No juega el mínimo de sets [team player]
    es: {jug} del equipo {eq} no ha disputado el mínimo de sets requeridos.
    ca: {jug} de l'equip {eq} no ha disputat el mínim de sets requerits.`

/**
 * Cabecera de un bloque: título, campos entre corchetes y rótulo opcional entre comillas
 * angulares.
 */
const HEADER = /^==\s+(.+?)\s+\[([^\]]*)\](?:\s+«([^»]+)»)?$/

/**
 * Línea con la frase de un idioma.
 */
const PHRASE = /^(es|ca):\s+(.*)$/

/**
 * Convierte el texto de la tabla en una lista de plantillas. Una línea que no es cabecera ni
 * frase prolonga la última frase leída; así una frase larga se puede partir sin cambiarla,
 * porque las frases no llevan espacios dobles.
 * @param {string} source tabla
 * @returns {Array<{title: string, fields: string[], text: {es: string, ca: string},
 *     label?: string}>}
 */
function parseTemplates(source) {
    const list = []
    let entry = null
    let language = null
    for (const rawLine of source.split("\n")) {
        const line = rawLine.trim()
        if (line === "") {
            continue
        }
        const header = HEADER.exec(line)
        if (header !== null) {
            entry = { title: header[1], fields: header[2].split(/\s+/).filter(Boolean), text: {} }
            if (header[3] !== undefined) {
                entry.label = header[3]
            }
            list.push(entry)
            language = null
            continue
        }
        const phrase = PHRASE.exec(line)
        if (phrase !== null) {
            language = phrase[1]
            entry.text[language] = phrase[2]
            continue
        }
        entry.text[language] += " " + line
    }
    return list
}

/**
 * Plantillas de observación en el orden en que se ofrecen. Cada una lleva su título (lo que se
 * ve en el desplegable), los campos que pide, la frase en castellano y en catalán y, si la
 * casilla de cantidad o de texto libre necesita otro nombre, su rótulo.
 * @type {ReadonlyArray<Readonly<{title: string, fields: ReadonlyArray<string>,
 *     text: Readonly<{es: string, ca: string}>, label?: string}>>}
 */
export const REMARK_TEMPLATES = Object.freeze(parseTemplates(SOURCE).map(freezeTemplate))

/**
 * Congela una plantilla con sus listas internas, para que nadie la cambie desde una vista.
 * @param {object} entry plantilla recién leída
 * @returns {Readonly<object>}
 */
function freezeTemplate(entry) {
    Object.freeze(entry.fields)
    Object.freeze(entry.text)
    return Object.freeze(entry)
}
