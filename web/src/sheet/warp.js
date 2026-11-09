/**
 * Traslado de coordenadas del modelo estándar al modelo infantil. Los dos impresos tienen las
 * mismas casillas, pero el infantil las dibuja algo más anchas y movidas; en vez de medir dos
 * veces cada posición, todo se calcula sobre el estándar y se traslada aquí.
 * @module src/sheet/warp.js
 */

/**
 * Tabla del traslado al modelo infantil, en milímetros y en texto para que se lea como una
 * tabla.
 *
 * - `zone nombre x0 y0 x1 y1`: rectángulo del estándar (semiabierto por la derecha y por
 *   abajo) en el que rige la zona.
 * - `x nombre pendiente desplazamiento` (y lo mismo con `y`): eje de esa zona, la recta que
 *   mejor lleva las rayas del estándar sobre las del infantil. Las líneas sangradas que siguen
 *   son parejas `estándar>infantil`: el centro de una misma raya de la cuadrícula en los dos
 *   SVG. Entre dos parejas se interpola y fuera de ellas se usa la recta.
 */
export const KIDS_WARP = `
# zona          x0      y0      x1      y1
zone header            0       0   297.1    17.6
zone period1           0    17.6   148.4    64.2
zone period2       148.4    17.6   297.1    64.2
zone period3           0    64.2   148.4   109.7
zone period4       148.4    64.2   297.1   109.7
zone decider1          0   109.7      79   155.6
zone decider2         79   109.7   148.4   155.6
zone decider3      148.4   109.7   218.4   155.6
zone footerLeft        0   155.6  163.51     210
zone footerRight  163.51   155.6   218.4     210

x header 1.01505 -2.686
    2.99>0.35 198.2>198.49 214.01>214.56 219.64>220.25 228.07>228.83 229.57>230.33 232.17>232.98
    234.84>235.68 244.5>245.49 245.09>246.09 247.99>249.05 248.2>249.26 248.96>250.02
    249.68>250.74 250.4>251.46 251.14>252.24 251.35>252.45 257.29>258.47 264.01>265.3
    294.88>296.64

x period1 1.01491 -2.708
    2.99>0.26 10.52>7.98 15.63>13.14 20.49>18.13 25.17>22.84 25.4>23.07 26.01>23.69 30.26>28.02
    34.47>32.27 35.17>32.97 35.29>33.12 36.14>33.98 39.92>37.83 44.49>42.44 44.94>42.91
    49.8>47.85 54.7>52.8 59.61>57.79 64.47>62.74 65.13>63.39 69.12>67.43 79.69>78.17 84.81>83.37
    89.67>88.32 94.35>93.03 94.58>93.27 95.19>93.88 99.44>98.21 103.65>102.46 104.35>103.2
    104.47>103.33 105.32>104.2 109.1>108.02 113.67>112.65 114.11>113.1 118.98>118.05
    123.88>123.04 128.79>127.98 133.65>132.93 134.3>133.59 138.3>137.67

x period2 1.01507 -2.931
    148.93>148.34 156.65>156.1 161.77>161.26 166.63>166.21 171.3>170.97 171.54>171.2
    172.15>171.81 176.4>176.14 180.61>180.4 181.3>181.09 181.45>181.24 182.3>182.09
    186.06>185.96 190.63>190.54 191.07>191.03 195.98>195.98 200.84>200.92 205.75>205.91
    210.61>210.86 211.26>211.52 215.26>215.56 225.83>226.3 230.95>231.45 235.81>236.44
    240.48>241.16 240.71>241.39 241.33>242 245.58>246.34 249.79>250.59 250.48>251.33
    251.48>252.32 255.24>256.15 259.81>260.78 260.25>261.22 265.16>266.17 270.02>271.16
    274.92>276.11 279.79>281.05 280.44>281.71 284.44>285.79 294.9>296.64

x period3 1.01491 -2.708
    2.99>0.26 10.52>7.98 15.63>13.14 20.49>18.13 25.17>22.84 25.4>23.07 26.01>23.69 30.26>28.02
    34.47>32.27 35.17>32.97 35.29>33.12 36.14>33.98 39.92>37.83 44.49>42.44 44.94>42.91
    49.8>47.85 54.7>52.8 59.61>57.79 64.47>62.74 65.13>63.39 69.12>67.43 79.69>78.17 84.81>83.37
    89.67>88.32 94.35>93.03 94.58>93.27 95.19>93.88 99.44>98.21 103.65>102.46 104.35>103.2
    104.47>103.33 105.32>104.2 109.1>108.02 113.67>112.65 114.11>113.1 118.98>118.05
    123.88>123.04 128.79>127.98 133.65>132.93 134.3>133.59 138.3>137.67

x period4 1.01507 -2.931
    148.93>148.34 156.65>156.1 161.77>161.26 166.63>166.21 171.3>170.97 171.54>171.2
    172.15>171.81 176.4>176.14 180.61>180.4 181.3>181.09 181.45>181.24 182.3>182.09
    186.06>185.96 190.63>190.54 191.07>191.03 195.98>195.98 200.84>200.92 205.75>205.91
    210.61>210.86 211.26>211.52 215.26>215.56 225.83>226.3 230.95>231.45 235.81>236.44
    240.48>241.16 240.71>241.39 241.33>242 245.58>246.34 249.79>250.59 250.48>251.33
    251.48>252.32 255.24>256.15 259.81>260.78 260.25>261.22 265.16>266.17 270.02>271.16
    274.92>276.11 279.79>281.05 280.44>281.71 284.44>285.79 294.9>296.64

x decider1 1.01443 -2.873
    3.09>0.26 10.68>7.98 15.8>13.14 20.71>18.13 25.34>22.84 25.57>23.07 26.18>23.69 30.47>28.02
    34.64>32.27 35.34>32.97 35.48>33.12 36.33>33.98 40.11>37.83 44.66>42.44 45.1>42.91
    50.01>47.85 54.91>52.8 59.78>57.79 64.68>62.74 65.32>63.39 69.31>67.43

x decider2 1.01452 -2.855
    79.86>78.17 84.98>83.37 89.88>88.32 94.51>93.03 94.75>93.27 95.36>93.88 99.65>98.21
    103.82>102.46 104.51>103.2 104.66>103.33 105.51>104.2 109.29>108.02 113.84>112.65
    114.28>113.1 119.19>118.05 124.09>123.04 128.96>127.98 133.86>132.93 134.5>133.59
    138.49>137.67

x decider3 1.01477 -3.975
    150.1>148.36 155.21>153.52 160.12>158.47 164.75>163.23 164.98>163.46 165.6>164.07
    169.89>168.41 174.05>172.66 174.75>173.35 174.9>173.5 175.74>174.35 179.53>178.22
    184.07>182.81 184.52>183.29 189.42>188.24 194.33>193.19 199.19>198.18 204.1>203.12
    204.71>203.78 208.71>207.82

x footerLeft 1.01434 -2.631
    2.95>0.35 8.15>5.63 13.35>10.92 18.57>16.2 21.76>19.44 23.77>21.49 28.97>26.77 34.17>32.04
    45.44>43.46 96.06>94.81 104.6>103.46 113.14>112.13 122.36>121.49

x footerRight 1.00366 -1.25
    163.82>163.48 170.69>169.89 176.86>176.14 183.04>182.36 191.66>191.07 200.29>199.78
    206.46>206 212.64>212.26

y header 1.0095 -0.658
    2.26>1.63 7.63>7.04 13.3>12.77

y period1 1.00964 -0.615
    18.77>18.29 21.06>20.68 23.34>22.96 27.91>27.57 32.52>32.22 37.08>36.83 41.65>41.44
    46.22>46.05 50.78>50.66 55.35>55.27 59.92>59.89

y period2 1.00956 -0.651
    18.82>18.29 21.1>20.68 23.38>22.96 27.95>27.57 32.52>32.22 37.13>36.83 41.69>41.44
    46.26>46.05 50.83>50.66 55.39>55.27 59.96>59.89

y period3 1.01067 -0.475
    64.51>64.59 66.77>67.06 69.09>69.39 73.66>74 78.23>78.61 82.79>83.22 87.36>87.83 91.93>92.43
    96.49>97.04 101.06>101.65 105.63>106.26

y period4 1.00933 -0.464
    64.55>64.59 66.9>67.06 69.18>69.39 73.75>74 78.31>78.61 82.88>83.22 87.44>87.83 92.05>92.43
    96.62>97.04 101.19>101.65 105.75>106.26

y decider1 1.0094 -0.389
    110.24>110.89 112.52>113.21 114.85>115.52 119.41>120.13 123.98>124.74 128.55>129.35
    133.11>134 137.68>138.61 142.25>143.22 146.86>147.83 151.42>152.44

y decider2 1.0094 -0.389
    110.24>110.89 112.52>113.21 114.85>115.52 119.41>120.13 123.98>124.74 128.55>129.35
    133.11>134 137.68>138.61 142.25>143.22 146.86>147.83 151.42>152.44

y decider3 1.01164 -0.702
    110.24>110.74 119.41>120.13 123.98>124.74 128.55>129.35 133.11>134 137.68>138.61
    142.25>143.22 146.86>147.83 151.42>152.44

y footerLeft 0.98307 3.86
    155.99>157.24 160.47>161.61 165.08>166.14 169.65>170.62 174.26>175.17 181.23>181.99
    181.83>182.61 186.39>187.11 187.32>188 190.62>191.26 194.3>194.89 194.85>195.4 199.08>199.59
    201.42>201.85 203.31>203.73 207.53>207.89

y footerRight 1.00507 0.512
    155.99>157.05 160.47>161.82 165.04>166.43 169.6>171.04 174.17>175.65 178.78>180.26
    183.35>184.87 187.91>189.48 192.67>194.3 197.75>198.91`

/**
 * Valor de un eje en un punto: interpolación lineal entre las parejas que lo rodean y, por
 * fuera, la recta con la pendiente del eje apoyada en la pareja más cercana.
 * @param {{slope: number, offset: number, knots: number[]}} axis eje de una zona
 * @param {number} value coordenada en el estándar
 * @returns {number} coordenada en el infantil
 */
function piecewise(axis, value) {
    const knots = axis.knots
    const count = knots.length / 2
    if (count === 0) {
        return axis.slope * value + axis.offset
    }
    if (value <= knots[0]) {
        return knots[1] + axis.slope * (value - knots[0])
    }
    for (let pair = 1; pair < count; pair++) {
        const toX = knots[2 * pair]
        if (value <= toX) {
            const fromX = knots[2 * pair - 2]
            const fromY = knots[2 * pair - 1]
            const toY = knots[2 * pair + 1]
            return fromY + (toY - fromY) * (value - fromX) / (toX - fromX)
        }
    }
    return knots[2 * count - 1] + axis.slope * (value - knots[2 * count - 2])
}

/**
 * Convierte la tabla de texto en zonas con sus dos ejes, en el orden en que se declaran.
 * @param {string} table texto con el formato de KIDS_WARP
 * @returns {Map<string, {box: number[], x: object, y: object}>}
 */
function parseWarp(table) {
    const zones = new Map()
    let axis = null
    for (const line of table.split("\n")) {
        const words = line.trim().split(/\s+/)
        if (words[0] === "" || words[0].startsWith("#")) {
            continue
        }
        if (words[0] === "zone") {
            const box = words.slice(2).map(parseFloat)
            zones.set(words[1], { box, x: null, y: null })
            continue
        }
        if (words[0] === "x" || words[0] === "y") {
            axis = {
                slope: parseFloat(words[2]),
                offset: parseFloat(words[3]),
                knots: [],
            }
            zones.get(words[1])[words[0]] = axis
            continue
        }
        for (const pair of words) {
            const [from, to] = pair.split(">")
            axis.knots.push(parseFloat(from), parseFloat(to))
        }
    }
    return zones
}

/**
 * Traslada puntos del modelo estándar a otro dibujo por zonas. Cada figura se traslada entera
 * con la zona de su primer punto, para que una raya que cruza un borde no se parta en dos.
 */
export class Warp {
    #zones

    /**
     * @param {string} table tabla con el formato de KIDS_WARP
     */
    constructor(table) {
        this.#zones = parseWarp(table)
    }

    /**
     * Zona que contiene un punto, o null si cae fuera de todas (entonces no se mueve).
     * @param {number} x abscisa en el estándar
     * @param {number} y ordenada en el estándar
     * @returns {object|null}
     */
    zoneAt(x, y) {
        for (const zone of this.#zones.values()) {
            const [left, top, right, bottom] = zone.box
            if (x >= left && x < right && y >= top && y < bottom) {
                return zone
            }
        }
        return null
    }

    /**
     * Traslada una figura dada como lista plana [x1, y1, x2, y2, …].
     * @param {number[]} points coordenadas alternas en el estándar
     * @returns {number[]} las mismas coordenadas en el otro dibujo
     */
    warpPoints(points) {
        const zone = this.zoneAt(points[0], points[1])
        if (!zone) {
            return points
        }
        const moved = []
        for (let i = 0; i < points.length; i += 2) {
            moved.push(piecewise(zone.x, points[i]), piecewise(zone.y, points[i + 1]))
        }
        return moved
    }
}
