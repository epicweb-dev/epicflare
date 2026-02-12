import { expect, test } from 'bun:test'
import {
	assertDependencyOverrideConsistency,
	expectedVersionFromPackage,
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
