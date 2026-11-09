/**
 * Lanza la batería completa: primero todas las pruebas *.test.mjs con el ejecutor de Node y,
 * si pasan, una tanda corta de partidos aleatorios. Los oráculos externos no entran porque
 * necesitan red y herramientas aparte; se ejecutan a mano.
 *
 * Uso: node tests/run-all.mjs [--games N] [--seed S]
 * @module tests/run-all.mjs
 */
import { spawnSync } from "node:child_process"
import { readdirSync } from "node:fs"
import { join, relative } from "node:path"
import { fileURLToPath } from "node:url"

/** Carpeta tests/. */
const TESTS_ROOT = fileURLToPath(new URL(".", import.meta.url))

/** Carpeta raíz del proyecto, desde la que se ejecuta todo. */
const PROJECT_ROOT = fileURLToPath(new URL("..", import.meta.url))

/** Partidos de la tanda corta si no se indica otra cosa. */
const SHORT_FUZZ_GAMES = "100"

/** Semilla de la tanda corta si no se indica otra cosa. */
const SHORT_FUZZ_SEED = "20"

/**
 * Lista ordenada de archivos de prueba bajo una carpeta.
 * @param {string} dir carpeta absoluta
 * @returns {string[]} rutas relativas a la raíz del proyecto, con barras normales
 */
export function testFiles(dir = TESTS_ROOT) {
    const found = []
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = join(dir, entry.name)
        if (entry.isDirectory()) {
            found.push(...testFiles(full))
        } else if (entry.name.endsWith(".test.mjs")) {
            found.push(relative(PROJECT_ROOT, full).replace(/\\/g, "/"))
        }
    }
    return found.sort()
}

/**
 * Ejecuta node con argumentos, mostrando su salida, y devuelve el código.
 * @param {string[]} args argumentos de node
 * @returns {number}
 */
function runNode(args) {
    const result = spawnSync(process.execPath, args, { cwd: PROJECT_ROOT, stdio: "inherit" })
    return result.status ?? 1
}

/**
 * Valor de una opción con su valor por defecto.
 * @param {string[]} args argumentos
 * @param {string} flag opción
 * @param {string} fallback valor por defecto
 * @returns {string}
 */
function optionValue(args, flag, fallback) {
    const index = args.indexOf(flag)
    return index >= 0 && args[index + 1] ? args[index + 1] : fallback
}

/**
 * Ejecuta todas las pruebas.
 * @param {string[]} args argumentos de la línea de órdenes
 * @returns {Promise<number>} código de salida
 */
export async function runAll(args) {
    const unitStatus = runNode(["--test", ...testFiles()])
    if (unitStatus !== 0) {
        console.log("\nLas pruebas unitarias fallan; no se lanza el fuzz.")
        return unitStatus
    }
    const games = optionValue(args, "--games", SHORT_FUZZ_GAMES)
    const seed = optionValue(args, "--seed", SHORT_FUZZ_SEED)
    console.log("\nFuzz corto: " + games + " partidos con semilla " + seed)
    return runNode(["tests/fuzz/random-matches.mjs", "--games", games, "--seed", seed])
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    process.exitCode = await runAll(process.argv.slice(2))
}
