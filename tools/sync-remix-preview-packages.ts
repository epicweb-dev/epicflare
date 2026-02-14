import { spawnSync } from 'node:child_process'
import {
	access,
	cp,
	mkdtemp,
	mkdir,
	readdir,
	readFile,
	rm,
	stat,
	writeFile as writeFilePromise,
	writeFile,
} from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const remixPreviewTarballUrl =
	'https://codeload.github.com/remix-run/remix/tar.gz/refs/heads/preview/main'

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(scriptDir, '..')
const vendorRoot = path.join(repoRoot, 'vendor', 'remix-preview')
const vendorPackagesPath = path.join(vendorRoot, 'packages')

void syncRemixPreviewPackages().catch((error: unknown) => {
	console.error(error)
	process.exit(1)
})

async function syncRemixPreviewPackages() {
	const tempRoot = await mkdtemp(path.join(tmpdir(), 'remix-preview-sync-'))

	try {
		const tarballPath = path.join(tempRoot, 'preview-main.tar.gz')
		await downloadTarball(tarballPath)
		extractTarball(tarballPath, tempRoot)

		const extractedPackagesPath = await resolveExtractedPackagesPath(tempRoot)

		await rm(vendorRoot, { force: true, recursive: true })
		await mkdir(vendorRoot, { recursive: true })
		await cp(extractedPackagesPath, vendorPackagesPath, { recursive: true })
		await rewritePreviewDependencySpecs(vendorPackagesPath)

		console.log(
			`Synced Remix preview packages into ${path.relative(repoRoot, vendorPackagesPath)}`,
		)
	} finally {
		await rm(tempRoot, { force: true, recursive: true })
	}
}

async function downloadTarball(tarballPath: string) {
	console.log('Downloading Remix preview tarball...')

	const response = await fetch(remixPreviewTarballUrl)
	if (!response.ok) {
		throw new Error(
			`Failed to download Remix preview tarball (${response.status} ${response.statusText})`,
		)
	}

	const archiveBytes = new Uint8Array(await response.arrayBuffer())
	await writeFile(tarballPath, archiveBytes)
}

function extractTarball(tarballPath: string, destination: string) {
	console.log('Extracting Remix preview tarball...')
	const result = spawnSync('tar', ['-xzf', tarballPath, '-C', destination], {
		stdio: 'inherit',
	})
	if (result.status !== 0) {
		throw new Error(`Failed to extract tarball from ${tarballPath}`)
	}
}

async function resolveExtractedPackagesPath(tempRoot: string) {
	const directories = await readdirDirectories(tempRoot)

	for (const dir of directories) {
		const packagesPath = path.join(tempRoot, dir, 'packages')
		const remixPackageJsonPath = path.join(packagesPath, 'remix', 'package.json')
		try {
			await access(remixPackageJsonPath)
			return packagesPath
		} catch {}
	}

	throw new Error('Could not locate extracted Remix packages directory')
}

async function readdirDirectories(dirPath: string) {
	const entries = await readdir(dirPath, { withFileTypes: true })
	return entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name)
}

async function rewritePreviewDependencySpecs(packagesPath: string) {
	const packageDirs = await readdirDirectories(packagesPath)
	const dependencyFields = [
		'dependencies',
		'devDependencies',
		'peerDependencies',
		'optionalDependencies',
	] as const
	const previewReferencePattern = /^remix-run\/remix#preview\/main&path:packages\/(.+)$/

	for (const packageDirName of packageDirs) {
		const packageJsonPath = path.join(packagesPath, packageDirName, 'package.json')
		try {
			const fileInfo = await stat(packageJsonPath)
			if (!fileInfo.isFile()) continue
		} catch {
			continue
		}

		const currentJson = JSON.parse(await readFile(packageJsonPath, 'utf8')) as Record<
			string,
			unknown
		>
		let didChange = false
		if ('devDependencies' in currentJson) {
			delete currentJson.devDependencies
			didChange = true
		}

		for (const field of dependencyFields) {
			const dependencyMap = currentJson[field]
			if (!dependencyMap || typeof dependencyMap !== 'object') continue

			for (const [dependencyName, dependencyVersion] of Object.entries(
				dependencyMap as Record<string, unknown>,
			)) {
				if (typeof dependencyVersion !== 'string') continue
				const match = dependencyVersion.match(previewReferencePattern)
				if (!match) continue
				;(dependencyMap as Record<string, string>)[dependencyName] =
					`file:../${match[1]}`
				didChange = true
			}
		}

		if (didChange) {
			await writeFilePromise(packageJsonPath, `${JSON.stringify(currentJson, null, 2)}\n`)
		}
	}
}
