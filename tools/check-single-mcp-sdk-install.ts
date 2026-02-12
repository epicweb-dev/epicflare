import { existsSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

export type PackageJson = {
	dependencies?: Record<string, string>
	overrides?: Record<string, string>
	version?: string
}

async function readPackageJson() {
	return (await Bun.file(
		new URL('../package.json', import.meta.url),
	).json()) as PackageJson
}

export function expectedSdkVersionFromPackageJson(packageJson: PackageJson) {
	return packageJson.overrides?.['@modelcontextprotocol/sdk'] ?? null
}

export function isExactVersion(version: string) {
	return /^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(version)
}

export function readInstalledSdkVersions(stdout: string) {
	const matches = Array.from(
		stdout.matchAll(/@modelcontextprotocol\/sdk@([0-9A-Za-z.-]+)/g),
	)
	return [...new Set(matches.map((match) => match[1] ?? ''))]
}

async function findNestedSdkInstallPaths(dependencyName: string) {
	return findNestedSdkInstallPathsFromRoot({
		dependencyName,
		workspaceRootPath: fileURLToPath(new URL('../', import.meta.url)),
	})
}

export async function findNestedSdkInstallPathsFromRoot({
	dependencyName,
	workspaceRootPath,
}: {
	dependencyName: string
	workspaceRootPath: string
}) {
	const dependencyRootPath = join(
		workspaceRootPath,
		'node_modules',
		dependencyName,
	)
	if (!existsSync(dependencyRootPath)) {
		return [] as Array<string>
	}

	const glob = new Bun.Glob(
		'**/node_modules/@modelcontextprotocol/sdk/package.json',
	)
	const paths: Array<string> = []
	for await (const path of glob.scan({
		cwd: dependencyRootPath,
		absolute: true,
		onlyFiles: true,
	})) {
		paths.push(path)
	}

	return paths.sort((left, right) => left.localeCompare(right))
}

export function resolveTopLevelSdkPackageJsonPath({
	workspaceRootPath,
}: {
	workspaceRootPath: string
}) {
	const packageJsonPath = join(
		workspaceRootPath,
		'node_modules',
		'@modelcontextprotocol',
		'sdk',
		'package.json',
	)
	if (!existsSync(packageJsonPath)) {
		throw new Error(
			`Expected top-level @modelcontextprotocol/sdk install at ${packageJsonPath}, but it was not found.`,
		)
	}
	return packageJsonPath
}

export function expectedVersionFromPackage(packageJson: PackageJson) {
	const expectedVersion = expectedSdkVersionFromPackageJson(packageJson)
	if (!expectedVersion) {
		throw new Error(
			'Expected @modelcontextprotocol/sdk override is missing from package.json.',
		)
	}
	if (!isExactVersion(expectedVersion)) {
		throw new Error(
			`Expected an exact @modelcontextprotocol/sdk version, but found "${expectedVersion}". Pin the version using package.json overrides.`,
		)
	}
	return expectedVersion
}

export function assertDependencyOverrideConsistency(
	packageJson: PackageJson,
	expectedVersion: string,
) {
	const dependencyVersion =
		packageJson.dependencies?.['@modelcontextprotocol/sdk'] ?? null
	if (!dependencyVersion) {
		throw new Error(
			'Expected @modelcontextprotocol/sdk dependency is missing from package.json dependencies.',
		)
	}
	if (dependencyVersion !== expectedVersion) {
		throw new Error(
			`Expected dependency and override versions for @modelcontextprotocol/sdk to match, but found dependencies="${dependencyVersion}" and overrides="${expectedVersion}".`,
		)
	}
}

async function main() {
	const packageJson = await readPackageJson()
	const expectedVersion = expectedVersionFromPackage(packageJson)
	assertDependencyOverrideConsistency(packageJson, expectedVersion)

	const processResult = Bun.spawnSync({
		cmd: [process.execPath, 'pm', 'ls', '--all'],
		stdout: 'pipe',
		stderr: 'pipe',
	})
	if (processResult.exitCode !== 0) {
		throw new Error(
			`Failed to inspect dependency tree.\n${processResult.stderr.toString()}`,
		)
	}

	const output = processResult.stdout.toString()
	const installedVersions = readInstalledSdkVersions(output)
	if (installedVersions.length !== 1) {
		throw new Error(
			`Expected exactly one installed @modelcontextprotocol/sdk version in dependency tree, found ${installedVersions.length} (${installedVersions.join(
				', ',
			)}).`,
		)
	}

	const installedVersion = installedVersions[0]
	if (installedVersion !== expectedVersion) {
		throw new Error(
			`Expected @modelcontextprotocol/sdk@${expectedVersion}, but found @modelcontextprotocol/sdk@${installedVersion}.`,
		)
	}

	const sensitiveDependencies = ['agents', '@mcp-ui/server']
	const nestedSdkInstallsByDependency = new Map<string, Array<string>>()
	for (const dependency of sensitiveDependencies) {
		const nestedInstallPaths = await findNestedSdkInstallPaths(dependency)
		if (nestedInstallPaths.length > 0) {
			nestedSdkInstallsByDependency.set(dependency, nestedInstallPaths)
		}
	}
	if (nestedSdkInstallsByDependency.size > 0) {
		const projectRootPath = fileURLToPath(new URL('../', import.meta.url))
		const details = Array.from(nestedSdkInstallsByDependency.entries())
			.map(([dependency, paths]) => {
				const relativePaths = paths.map((path) =>
					relative(projectRootPath, path),
				)
				return `${dependency}: ${relativePaths.join(', ')}`
			})
			.join(' | ')
		throw new Error(
			`Found nested @modelcontextprotocol/sdk installs under sensitive dependencies: ${details}.`,
		)
	}

	const projectRootPath = fileURLToPath(new URL('../', import.meta.url))
	const topLevelSdkPackageJsonPath = resolveTopLevelSdkPackageJsonPath({
		workspaceRootPath: projectRootPath,
	})
	const installedPackageJson = (await Bun.file(
		topLevelSdkPackageJsonPath,
	).json()) as PackageJson
	if (installedPackageJson.version !== expectedVersion) {
		throw new Error(
			`Physical install version mismatch: expected @modelcontextprotocol/sdk@${expectedVersion}, found @modelcontextprotocol/sdk@${installedPackageJson.version ?? 'unknown'}.`,
		)
	}

	console.log(
		`✅ Found single @modelcontextprotocol/sdk install at version ${installedVersion}.`,
	)
}

if (import.meta.main) {
	void main().catch((error: unknown) => {
		console.error(error)
		process.exit(1)
	})
}
