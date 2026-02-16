import { existsSync } from 'node:fs'
import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const projectRoot = fileURLToPath(new URL('..', import.meta.url))
const workerTypesPath = path.join(
	projectRoot,
	'types',
	'worker-configuration.d.ts',
)

if (!existsSync(workerTypesPath)) {
	console.log(`worker types file not found: ${workerTypesPath}`)
	process.exit(0)
}

const original = await readFile(workerTypesPath, 'utf8')

// Wrangler generates a relative reference to the worker entrypoint from within
// `types/`. We normalize it to the repo-root `#...` import alias so the output is
// stable and aligns with our `package.json` "imports" convention.
const next = original.replace(
	/import\((['"])(?:\.\.\/)+worker\/index(?:\.ts)?\1\)/g,
	'import($1#worker/index$1)',
)

if (next === original) {
	console.log('worker types imports already normalized')
	process.exit(0)
}

await writeFile(workerTypesPath, next, 'utf8')
console.log('normalized worker types imports')
