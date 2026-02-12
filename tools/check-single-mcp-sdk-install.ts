type PackageJson = {
	dependencies?: Record<string, string>
	overrides?: Record<string, string>
}

async function readPackageJson() {
	return (await Bun.file(
		new URL('../package.json', import.meta.url),
	).json()) as PackageJson
}

function expectedSdkVersionFromPackageJson(packageJson: PackageJson) {
	return (
		packageJson.overrides?.['@modelcontextprotocol/sdk'] ??
		packageJson.dependencies?.['@modelcontextprotocol/sdk'] ??
		null
	)
}

function readInstalledSdkVersions(stdout: string) {
	const matches = Array.from(
		stdout.matchAll(/@modelcontextprotocol\/sdk@([0-9A-Za-z.-]+)/g),
	)
	return matches.map((match) => match[1] ?? '')
}

async function main() {
	const packageJson = await readPackageJson()
	const expectedVersion = expectedSdkVersionFromPackageJson(packageJson)
	if (!expectedVersion) {
		throw new Error(
			'Expected @modelcontextprotocol/sdk version is missing from package.json.',
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
	const installedVersions = readInstalledSdkVersions(output)
	if (installedVersions.length !== 1) {
		throw new Error(
			`Expected exactly one installed @modelcontextprotocol/sdk, found ${installedVersions.length}.`,
		)
	}

	const installedVersion = installedVersions[0]
	if (installedVersion !== expectedVersion) {
		throw new Error(
			`Expected @modelcontextprotocol/sdk@${expectedVersion}, but found @modelcontextprotocol/sdk@${installedVersion}.`,
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
