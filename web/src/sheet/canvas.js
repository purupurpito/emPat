/**
 * Lienzo del acta impresa: acumula letras y trazos colocados sobre el fondo del impreso y al
 * final los entrega como HTML de posición absoluta. Las posiciones y los grosores van en
 * milímetros; los cuerpos de letra, en puntos tipográficos.
 * @module src/sheet/canvas.js
 */

import { escapeHtml } from "../app/dom.js"
import { estimateWidth, sheetTime } from "./metrics.js"

const JUSTIFY = { center: "center", right: "flex-end" }

/**
 * Puntos tipográficos que caben en un milímetro.
 */
export const PT_PER_MM = 72 / 25.4

/**
 * Altura de la línea base dentro de una caja de interlineado 1, como fracción del cuerpo y
 * contando desde arriba. Sale de las métricas de Arial (ascendente y descendente en unidades
 * de diseño de la fuente): la caja reparte por igual, arriba y abajo, lo que le sobra o le
 * falta respecto a la suma de los dos.
 */
const BASELINE_RATIO = (1 + (1854 - 434) / 2048) / 2

/**
 * Cuerpo, en puntos, que se da a un texto por cada milímetro de alto de su caja cuando no se
 * fija uno.
 */
const SIZE_PER_MM = 2.04

/**
 * Estrechamiento máximo de un texto que no cabe: más estrecho dejaría de leerse bien.
 */
const MIN_SQUEEZE = 0.54

/**
 * Grosor normal de una raya de tinta, en mm.
 */
const PEN = 0.29

/**
 * Superficie de dibujo de una página. Todo lo que se pinta se anota en orden y toString()
 * devuelve el marcado. Si se le da una deformación, cada figura pasa por ella salvo dentro de
 * unwarped(), que sirve para lo que ya se midió directamente sobre el impreso de destino.
 */
export class SheetCanvas {
    #warp
    #parts = []
    #rawDepth = 0

    /**
     * @param {{warp?: import("./warp.js").Warp|null}} [options] deformación opcional
     */
    constructor({ warp = null } = {}) {
        this.#warp = warp
    }

    /**
     * Pasa una figura por la deformación vigente.
     * @param {number[]} points coordenadas alternas x, y
     * @returns {number[]}
     */
    #place(points) {
        if (!this.#warp || this.#rawDepth > 0) {
            return points
        }
        return this.#warp.warpPoints(points)
    }

    /**
     * Texto en mayúsculas dentro de una caja, como se rellena un acta a mano. Si no cabe se
     * estrecha horizontalmente hasta un mínimo, nunca se parte ni se recorta. Un texto vacío o
     * ausente no deja nada.
     * @param {number} x izquierda de la caja, en mm
     * @param {number} y arriba de la caja, en mm
     * @param {number} w ancho, en mm
     * @param {number} h alto, en mm
     * @param {unknown} value lo que se escribe
     * @param {{size?: number, align?: string, bold?: boolean}} [options] cuerpo fijo en puntos,
     *   alineación ("left", "center" o "right") y negrita
     */
    text(x, y, w, h, value, options = {}) {
        if (value === null || value === undefined || value === "") {
            return
        }
        const [left, top, right, bottom] = this.#place([x, y, x + w, y + h])
        const width = right - left
        const height = bottom - top
        const label = String(value).toUpperCase()
        const size = options.size || Math.max(6.5, Math.min(height * SIZE_PER_MM, 9.5))
        const natural = estimateWidth(label, size)
        let squeeze = 1
        if (natural > width) {
            squeeze = Math.max(MIN_SQUEEZE, width / natural)
        }
        const align = options.align || "left"
        const justify = JUSTIFY[align] || "flex-start"
        let origin = "left"
        if (align === "center" || align === "right") {
            origin = align
        }
        let weight = ""
        if (options.bold) {
            weight = ";font-weight:700"
        }
        const box = `left:${left}mm;top:${top}mm;width:${width}mm;height:${height}mm`
        const look = `font-size:${size}pt;justify-content:${justify}${weight}`
        const stretch = `transform:scaleX(${squeeze.toFixed(3)});transform-origin:${origin} center`
        const span = `<span style="${stretch}">${escapeHtml(label)}</span>`
        this.#parts.push(`<div class="ink-text" style="${box};${look}">${span}</div>`)
    }

    /**
     * Texto apoyado sobre un renglón: se da la línea base en lugar de la caja, como cuando
     * se escribe encima de una raya impresa.
     * @param {number} x izquierda, en mm
     * @param {number} base ordenada de la línea base, en mm
     * @param {number} w ancho disponible, en mm
     * @param {unknown} value lo que se escribe
     * @param {{size?: number, align?: string, bold?: boolean}} [options] como en text()
     */
    baseline(x, base, w, value, options = {}) {
        const size = options.size || 9.5
        const body = size / PT_PER_MM
        this.text(x, base - BASELINE_RATIO * body, w, body, value, { ...options, size })
    }

    /**
     * Raya recta entre dos puntos, de grosor `g`. Todo en mm.
     * @param {number} x1 origen x
     * @param {number} y1 origen y
     * @param {number} x2 destino x
     * @param {number} y2 destino y
     * @param {number} [g] grosor
     */
    line(x1, y1, x2, y2, g = PEN) {
        const [ax, ay, bx, by] = this.#place([x1, y1, x2, y2])
        const length = Math.hypot(bx - ax, by - ay)
        const degrees = Math.atan2(by - ay, bx - ax) * 180 / Math.PI
        const box = `left:${ax}mm;top:${ay - g / 2}mm;width:${length}mm;border-top-width:${g}mm`
        const turn = `transform:rotate(${degrees.toFixed(2)}deg)`
        this.#parts.push(`<div class="ink-line" style="${box};${turn}"></div>`)
    }

    /**
     * Círculo con centro deformable y radio fijo. Todo en mm.
     * @param {number} cx centro x
     * @param {number} cy centro y
     * @param {number} r radio
     */
    ring(cx, cy, r) {
        const [x, y] = this.#place([cx, cy])
        this.ringRaw(x, y, r)
    }

    /**
     * Círculo colocado tal cual, sin pasar por la deformación. Todo en mm.
     * @param {number} cx centro x
     * @param {number} cy centro y
     * @param {number} r radio
     */
    ringRaw(cx, cy, r) {
        const box = `left:${cx - r}mm;top:${cy - r}mm;width:${2 * r}mm;height:${2 * r}mm`
        this.#parts.push(`<div class="ink-ring" style="${box}"></div>`)
    }

    /**
     * Aspa que anula una casilla, medio milímetro hacia dentro de cada esquina.
     * @param {number} x izquierda
     * @param {number} y arriba
     * @param {number} w ancho
     * @param {number} h alto
     */
    cross(x, y, w, h) {
        const inset = 0.5
        this.line(x + inset, y + inset, x + w - inset, y + h - inset)
        this.line(x + w - inset, y + inset, x + inset, y + h - inset)
    }

    /**
     * Reloj de arena: dos horizontales y dos diagonales que anulan un tramo sin usar.
     * @param {number} x1 izquierda
     * @param {number} y1 arriba
     * @param {number} x2 derecha
     * @param {number} y2 abajo
     */
    hourglass(x1, y1, x2, y2) {
        this.line(x1, y1, x2, y1)
        this.line(x1, y2, x2, y2)
        this.line(x1, y1, x2, y2)
        this.line(x2, y1, x1, y2)
    }

    /**
     * Cierra un hueco libre como se hace a mano: raya horizontal y, desde su final, una
     * diagonal hasta abajo; si no queda sitio debajo, una barra corta. Un hueco de menos de
     * 2,1 mm no se cierra.
     * @param {number} x1 inicio de la raya
     * @param {number} y altura de la raya
     * @param {number} x2 final de la raya
     * @param {number} xd destino de la diagonal, x
     * @param {number} yd destino de la diagonal, y
     */
    tail(x1, y, x2, xd, yd) {
        if (x2 - x1 < 2.1) {
            return
        }
        this.line(x1, y, x2, y)
        if (yd > y + 1.05) {
            this.line(x2, y, xd, yd)
            return
        }
        this.line(x2 - 0.9, y + 0.9, x2 + 0.9, y - 1.6)
    }

    /**
     * Cierra lo que sobra de un grupo de renglones después del texto escrito en ellos. Si al
     * último renglón usado le quedan menos de 6,4 mm, el cierre empieza en el siguiente.
     * @param {number[][]} rows renglones [x inicial, altura, x final]
     * @param {string[]} parts texto escrito, uno por renglón usado
     * @param {number} size cuerpo con que se escribió
     * @param {number[]} end destino de la diagonal [x, y]
     */
    tailRows(rows, parts, size, [xd, yd]) {
        let row = parts.length - 1
        let start
        if (row < 0) {
            row = 0
            start = rows[0][0]
        } else {
            const written = estimateWidth(String(parts[row]).toUpperCase(), size)
            start = rows[row][0] + written + 1.4
            if (rows[row][2] - start < 6.4) {
                row += 1
                if (row >= rows.length) {
                    return
                }
                start = rows[row][0]
            }
        }
        let bottom = rows[row][1]
        if (row < rows.length - 1) {
            bottom = yd
        }
        this.tail(start, rows[row][1], rows[row][2], xd, bottom)
    }

    /**
     * Hora a los dos lados de unos dos puntos impresos: la hora pegada por la derecha a 0,75 mm
     * del centro de los dos puntos y los minutos empezando 0,45 mm después de ese centro.
     * @param {string|null} iso instante
     * @param {number} xh inicio de la casilla de la hora, en mm
     * @param {number} xc centro de los dos puntos impresos, en mm
     * @param {number} base línea base, en mm
     */
    splitTime(iso, xh, xc, base) {
        const [hours, minutes] = sheetTime(iso).split(":")
        if (!hours) {
            return
        }
        this.baseline(xh, base, xc - 0.75 - xh, hours, { align: "right", size: 9 })
        this.baseline(xc + 0.45, base, 5.65, minutes, { size: 9 })
    }

    /**
     * Ejecuta `draw` sin deformación. Se puede anidar: la deformación vuelve al salir del
     * último nivel.
     * @template T
     * @param {() => T} draw dibujo
     * @returns {T}
     */
    unwarped(draw) {
        this.#rawDepth += 1
        try {
            return draw()
        } finally {
            this.#rawDepth -= 1
        }
    }

    /**
     * @returns {string} el marcado de todo lo dibujado, en orden
     */
    toString() {
        return this.#parts.join("")
    }
}
