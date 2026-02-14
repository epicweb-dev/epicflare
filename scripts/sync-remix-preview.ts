import { spawnSync } from 'node:child_process'
import { access, readFile, readdir, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'

const remixRepoUrl = 'https://github.com/remix-run/remix.git'
const preferredPreviewRefs = ['preview', 'preview/main']
const projectRoot = process.cwd()
const checkoutPath = path.join(projectRoot, '.remix-preview')
const checkoutPackagesPath = path.join(checkoutPath, 'packages')
const projectPackageJsonPath = path.join(projectRoot, 'package.json')

void syncRemixPreview().catch((error: unknown) => {
	console.error(error)
	process.exit(1)
})

async function syncRemixPreview() {
	if (process.env.SKIP_REMIX_PREVIEW === '1') {
		console.log('Skipping remix preview sync (SKIP_REMIX_PREVIEW=1).')
		return
	}

	const checkoutExists = await pathExists(checkoutPath)
	if (!checkoutExists) {
		await clonePreviewCheckout()
	} else {
		await updatePreviewCheckout()
	}

	const packageDirectoryByName = await buildPackageDirectoryMap()
	await rewritePreviewPackageManifests()
	await rewriteProjectDependencies(packageDirectoryByName)
}

async function clonePreviewCheckout() {
	let lastError: Error | null = null

	for (const ref of preferredPreviewRefs) {
		const result = runCommand(
			'git',
			['clone', '--depth', '1', '--branch', ref, remixRepoUrl, checkoutPath],
			projectRoot,
		)
		if (result.status === 0) {
			return
		}
		lastError = new Error(
			`Failed to clone remix preview branch "${ref}": ${result.stderr}`,
		)
	}

	throw (
		lastError ??
		new Error('Failed to clone remix preview branch from remix-run/remix.')
	)
}

async function updatePreviewCheckout() {
	let lastError: Error | null = null

	for (const ref of preferredPreviewRefs) {
		const fetchResult = runCommand(
			'git',
			['fetch', '--depth', '1', 'origin', ref],
			checkoutPath,
		)
		if (fetchResult.status !== 0) {
			lastError = new Error(
				`Failed to fetch remix preview branch "${ref}": ${fetchResult.stderr}`,
			)
			continue
		}

		const checkoutResult = runCommand('git', ['checkout', ref], checkoutPath)
		if (checkoutResult.status !== 0) {
			lastError = new Error(
				`Failed to checkout remix preview branch "${ref}": ${checkoutResult.stderr}`,
			)
			continue
		}

		const pullResult = runCommand(
			'git',
			['pull', '--ff-only', 'origin', ref],
			checkoutPath,
		)
		if (pullResult.status !== 0) {
			lastError = new Error(
				`Failed to pull remix preview branch "${ref}": ${pullResult.stderr}`,
			)
			continue
		}

		return
	}

	throw (
		lastError ??
		new Error('Failed to update remix preview checkout from remix-run/remix.')
	)
}

async function buildPackageDirectoryMap() {
	const packageDirectoryByName = new Map<string, string>()
	const packageDirectoryEntries = await readdir(checkoutPackagesPath, {
		withFileTypes: true,
	})

	for (const packageDirectoryEntry of packageDirectoryEntries) {
		if (!packageDirectoryEntry.isDirectory()) continue

		const packageDirectoryPath = path.join(
			checkoutPackagesPath,
			packageDirectoryEntry.name,
		)
		const packageJsonPath = path.join(packageDirectoryPath, 'package.json')
		if (!(await pathExists(packageJsonPath))) continue

		const packageJson = JSON.parse(
			await readFile(packageJsonPath, 'utf8'),
		) as Record<string, unknown>
		const packageName = packageJson.name
		if (typeof packageName !== 'string' || packageName.length === 0) continue
		packageDirectoryByName.set(packageName, packageDirectoryPath)
	}

	return packageDirectoryByName
}

async function rewriteProjectDependencies(
	packageDirectoryByName: Map<string, string>,
) {
	const projectPackageJson = JSON.parse(
		await readFile(projectPackageJsonPath, 'utf8'),
	) as Record<string, unknown>
	let changed = false

	for (const dependencyField of ['dependencies', 'devDependencies'] as const) {
		const dependencies = projectPackageJson[dependencyField]
		if (!dependencies || typeof dependencies !== 'object') continue

		for (const [packageName, currentSpec] of Object.entries(
			dependencies as Record<string, unknown>,
		)) {
			if (packageName !== 'remix' && !packageName.startsWith('@remix-run/')) {
				continue
			}

			const packageDirectoryPath = packageDirectoryByName.get(packageName)
			if (!packageDirectoryPath) continue

			const linkPath = toPosixPath(
				path.relative(projectRoot, packageDirectoryPath),
			)
			const normalizedLinkPath = linkPath.startsWith('.')
				? linkPath
				: `./${linkPath}`
			const nextSpec = `file:${normalizedLinkPath}`
			if (currentSpec === nextSpec) continue
			;(dependencies as Record<string, string>)[packageName] = nextSpec
			changed = true
		}
	}

	if (!changed) return

	await writeFile(
		projectPackageJsonPath,
		`${JSON.stringify(projectPackageJson, null, 2)}\n`,
	)
}

async function pathExists(targetPath: string) {
	try {
		await access(targetPath)
		const targetStats = await stat(targetPath)
		return targetStats.isDirectory() || targetStats.isFile()
	} catch {
		return false
	}
}

async function rewritePreviewPackageManifests() {
	const packageDirectoryEntries = await readdir(checkoutPackagesPath, {
		withFileTypes: true,
	})
	const previewDependencyPattern =
		/^remix-run\/remix#preview(?:\/main)?&path:packages\/(.+)$/
	const dependencyFields = ['dependencies', 'optionalDependencies'] as const

	for (const packageDirectoryEntry of packageDirectoryEntries) {
		if (!packageDirectoryEntry.isDirectory()) continue

		const packageJsonPath = path.join(
			checkoutPackagesPath,
			packageDirectoryEntry.name,
			'package.json',
		)
		if (!(await pathExists(packageJsonPath))) continue

		const packageJson = JSON.parse(
			await readFile(packageJsonPath, 'utf8'),
		) as Record<string, unknown>
		let changed = false

		if ('devDependencies' in packageJson) {
			delete packageJson.devDependencies
			changed = true
		}

		for (const dependencyField of dependencyFields) {
			const dependencies = packageJson[dependencyField]
			if (!dependencies || typeof dependencies !== 'object') continue

			for (const [dependencyName, dependencySpec] of Object.entries(
				dependencies as Record<string, unknown>,
			)) {
				if (typeof dependencySpec !== 'string') continue
				const match = dependencySpec.match(previewDependencyPattern)
				if (!match) continue
				;(dependencies as Record<string, string>)[dependencyName] =
					`file:../${match[1]}`
				changed = true
			}
		}

		if (!changed) continue

		await writeFile(
			packageJsonPath,
			`${JSON.stringify(packageJson, null, 2)}\n`,
		)
	}
}

function toPosixPath(filePath: string) {
	return filePath.split(path.sep).join('/')
}

function runCommand(command: string, args: Array<string>, cwd: string) {
	const result = spawnSync(command, args, {
		cwd,
		encoding: 'utf8',
		stdio: 'pipe',
	})
	return {
		status: result.status ?? 1,
		stdout: result.stdout,
		stderr: result.stderr,
	}
}
