import { expect, test } from 'bun:test'
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
	assertDependencyOverrideConsistency,
	expectedSdkVersionFromPackageJson,
	expectedVersionFromPackage,
	findNestedSdkInstallPathsFromRoot,
	isExactVersion,
	readInstalledSdkVersions,
	type PackageJson,
} from './check-single-mcp-sdk-install.ts'

test('isExactVersion accepts semver and prerelease values', () => {
	expect(isExactVersion('1.26.0')).toBe(true)
	expect(isExactVersion('1.26.0-beta.1')).toBe(true)
	expect(isExactVersion('1.26.0+build.5')).toBe(true)
})

test('isExactVersion rejects ranges and tags', () => {
	expect(isExactVersion('^1.26.0')).toBe(false)
	expect(isExactVersion('~1.26.0')).toBe(false)
	expect(isExactVersion('latest')).toBe(false)
})

test('expectedVersionFromPackage requires exact override version', () => {
	const packageJson: PackageJson = {
		overrides: {
			'@modelcontextprotocol/sdk': '1.26.0',
		},
	}
	expect(expectedVersionFromPackage(packageJson)).toBe('1.26.0')
})

test('expectedSdkVersionFromPackageJson reads override version', () => {
	const packageJson: PackageJson = {
		overrides: {
			'@modelcontextprotocol/sdk': '1.26.0',
		},
	}
	expect(expectedSdkVersionFromPackageJson(packageJson)).toBe('1.26.0')
})

test('expectedSdkVersionFromPackageJson returns null when override missing', () => {
	const packageJson: PackageJson = {
		dependencies: {
			'@modelcontextprotocol/sdk': '1.26.0',
		},
	}
	expect(expectedSdkVersionFromPackageJson(packageJson)).toBeNull()
})

test('expectedVersionFromPackage throws when override missing', () => {
	const packageJson: PackageJson = {
		dependencies: {
			'@modelcontextprotocol/sdk': '1.26.0',
		},
	}
	expect(() => expectedVersionFromPackage(packageJson)).toThrow(
		'Expected @modelcontextprotocol/sdk override is missing from package.json.',
	)
})

test('expectedVersionFromPackage throws for non-exact override values', () => {
	const packageJson: PackageJson = {
		overrides: {
			'@modelcontextprotocol/sdk': '^1.26.0',
		},
	}
	expect(() => expectedVersionFromPackage(packageJson)).toThrow(
		'Expected an exact @modelcontextprotocol/sdk version',
	)
})

test('assertDependencyOverrideConsistency requires matching dependency value', () => {
	const packageJson: PackageJson = {
		dependencies: {
			'@modelcontextprotocol/sdk': '1.26.0',
		},
	}
	expect(() =>
		assertDependencyOverrideConsistency(packageJson, '1.26.0'),
	).not.toThrow()
})

test('assertDependencyOverrideConsistency throws for mismatched versions', () => {
	const packageJson: PackageJson = {
		dependencies: {
			'@modelcontextprotocol/sdk': '^1.26.0',
		},
	}
	expect(() =>
		assertDependencyOverrideConsistency(packageJson, '1.26.0'),
	).toThrow(
		'Expected dependency and override versions for @modelcontextprotocol/sdk',
	)
})

test('assertDependencyOverrideConsistency throws when dependency is missing', () => {
	const packageJson: PackageJson = {}
	expect(() =>
		assertDependencyOverrideConsistency(packageJson, '1.26.0'),
	).toThrow(
		'Expected @modelcontextprotocol/sdk dependency is missing from package.json dependencies.',
	)
})

test('readInstalledSdkVersions deduplicates parsed versions', () => {
	const output = `
├── @modelcontextprotocol/sdk@1.26.0
│  └─ agents@0.4.1 (requires 1.26.0)
├── @modelcontextprotocol/sdk@1.26.0
`
	expect(readInstalledSdkVersions(output)).toEqual(['1.26.0'])
})

test('readInstalledSdkVersions reports multiple unique versions', () => {
	const output = `
├── @modelcontextprotocol/sdk@1.26.0
├── @modelcontextprotocol/sdk@1.25.2
`
	expect(readInstalledSdkVersions(output)).toEqual(['1.26.0', '1.25.2'])
})

test('readInstalledSdkVersions returns empty list when no SDK is found', () => {
	expect(readInstalledSdkVersions('no sdk here')).toEqual([])
})

test('findNestedSdkInstallPathsFromRoot returns nested SDK installs', async () => {
	const workspaceRootPath = await mkdtemp(join(tmpdir(), 'mcp-sdk-check-'))
	try {
		const nestedSdkPath = join(
			workspaceRootPath,
			'node_modules',
			'agents',
			'node_modules',
			'inner-package',
			'node_modules',
			'@modelcontextprotocol',
			'sdk',
			'package.json',
		)
		await mkdir(join(nestedSdkPath, '..'), { recursive: true })
		await writeFile(nestedSdkPath, '{"name":"@modelcontextprotocol/sdk"}')

		const paths = await findNestedSdkInstallPathsFromRoot({
			dependencyName: 'agents',
			workspaceRootPath,
		})
		expect(paths).toEqual([nestedSdkPath])
	} finally {
		await rm(workspaceRootPath, { recursive: true, force: true })
	}
})

test('findNestedSdkInstallPathsFromRoot returns empty for missing dependency', async () => {
	const workspaceRootPath = await mkdtemp(join(tmpdir(), 'mcp-sdk-check-'))
	try {
		const paths = await findNestedSdkInstallPathsFromRoot({
			dependencyName: 'agents',
			workspaceRootPath,
		})
		expect(paths).toEqual([])
	} finally {
		await rm(workspaceRootPath, { recursive: true, force: true })
	}
})

test('findNestedSdkInstallPathsFromRoot handles scoped dependency names', async () => {
	const workspaceRootPath = await mkdtemp(join(tmpdir(), 'mcp-sdk-check-'))
	try {
		const nestedSdkPath = join(
			workspaceRootPath,
			'node_modules',
			'@mcp-ui',
			'server',
			'node_modules',
			'nested',
			'node_modules',
			'@modelcontextprotocol',
			'sdk',
			'package.json',
		)
		await mkdir(join(nestedSdkPath, '..'), { recursive: true })
		await writeFile(nestedSdkPath, '{"name":"@modelcontextprotocol/sdk"}')

		const paths = await findNestedSdkInstallPathsFromRoot({
			dependencyName: '@mcp-ui/server',
			workspaceRootPath,
		})
		expect(paths).toEqual([nestedSdkPath])
	} finally {
		await rm(workspaceRootPath, { recursive: true, force: true })
	}
})

test('findNestedSdkInstallPathsFromRoot returns sorted paths', async () => {
	const workspaceRootPath = await mkdtemp(join(tmpdir(), 'mcp-sdk-check-'))
	try {
		const laterPath = join(
			workspaceRootPath,
			'node_modules',
			'agents',
			'node_modules',
			'zeta',
			'node_modules',
			'@modelcontextprotocol',
			'sdk',
			'package.json',
		)
		const earlierPath = join(
			workspaceRootPath,
			'node_modules',
			'agents',
			'node_modules',
			'alpha',
			'node_modules',
			'@modelcontextprotocol',
			'sdk',
			'package.json',
		)
		await mkdir(join(laterPath, '..'), { recursive: true })
		await mkdir(join(earlierPath, '..'), { recursive: true })
		await writeFile(laterPath, '{"name":"@modelcontextprotocol/sdk"}')
		await writeFile(earlierPath, '{"name":"@modelcontextprotocol/sdk"}')

		const paths = await findNestedSdkInstallPathsFromRoot({
			dependencyName: 'agents',
			workspaceRootPath,
		})
		expect(paths).toEqual([earlierPath, laterPath])
	} finally {
		await rm(workspaceRootPath, { recursive: true, force: true })
	}
})
