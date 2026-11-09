/**
 * Anotaciones que no cambian el juego: observaciones y firmas. Ninguna mira la fase, porque el
 * acta se puede anotar y firmar en cualquier momento.
 * @module src/rules/plays/paperwork.js
 */

/** Longitud máxima de una observación; lo que sobra se corta en silencio. */
const NOTE_MAX = 1000

/**
 * Añade una observación al acta, ligada al set actual.
 * @param {Match} match partido que se modifica
 * @param {object} play jugada ya normalizada {text}
 * @param {string|null} at marca de tiempo ISO
 */
export function note(match, play, at) {
    const text = String(play.text || "").slice(0, NOTE_MAX)
    match.notes.push({ text, period: match.current.number, at })
}

/**
 * Guarda una firma en su casilla; firmar otra vez la misma casilla sustituye la anterior.
 * @param {Match} match partido que se modifica
 * @param {object} play jugada ya normalizada {slot, signer, image}
 * @param {string|null} at marca de tiempo ISO
 */
export function sign(match, play, at) {
    match.signatures[play.slot] = { signer: play.signer || "", image: play.image, at }
}
