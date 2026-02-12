import { existsSync } from 'node:fs'

type PackageJson = {
	dependencies?: Record<string, string>
	overrides?: Record<string, string>
	version?: string
}

async function readPackageJson() {
	return (await Bun.file(
		new URL('../package.json', import.meta.url),
	).json()) as PackageJson
}

function expectedSdkVersionFromPackageJson(packageJson: PackageJson) {
	return packageJson.overrides?.['@modelcontextprotocol/sdk'] ?? null
}

function isExactVersion(version: string) {
	return /^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(version)
}

function readInstalledSdkVersions(stdout: string) {
	const matches = Array.from(
		stdout.matchAll(/@modelcontextprotocol\/sdk@([0-9A-Za-z.-]+)/g),
	)
	return matches.map((match) => match[1] ?? '')
}

function hasNestedSdkInstall(dependencyName: string) {
	return existsSync(
		new URL(
			`../node_modules/${dependencyName}/node_modules/@modelcontextprotocol/sdk/package.json`,
			import.meta.url,
		),
	)
}

async function main() {
	const packageJson = await readPackageJson()
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
	const installedVersions = [...new Set(readInstalledSdkVersions(output))]
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
	const dependenciesWithNestedSdk = sensitiveDependencies.filter((dependency) =>
		hasNestedSdkInstall(dependency),
	)
	if (dependenciesWithNestedSdk.length > 0) {
		throw new Error(
			`Found nested @modelcontextprotocol/sdk installs under sensitive dependencies: ${dependenciesWithNestedSdk.join(
				', ',
			)}.`,
		)
	}

	const installedPackageJson = (await Bun.file(
		new URL(
			'../node_modules/@modelcontextprotocol/sdk/package.json',
			import.meta.url,
		),
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

void main().catch((error: unknown) => {
	console.error(error)
	process.exit(1)
})
