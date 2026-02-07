const passwordHashPrefix = 'pbkdf2_sha256'
const passwordSaltBytes = 16
const passwordHashBytes = 32
const passwordHashIterations = 120_000
const legacyPasswordHashPattern = /^[0-9a-f]{64}$/i

function toHex(bytes: Uint8Array) {
	return Array.from(bytes)
		.map((value) => value.toString(16).padStart(2, '0'))
		.join('')
}

function fromHex(value: string) {
	const normalized = value.trim().toLowerCase()
	if (!/^[0-9a-f]+$/.test(normalized) || normalized.length % 2 !== 0) {
		return null
	}
	const bytes = new Uint8Array(normalized.length / 2)
	for (let index = 0; index < normalized.length; index += 2) {
		const byte = Number.parseInt(normalized.slice(index, index + 2), 16)
		if (Number.isNaN(byte)) return null
		bytes[index / 2] = byte
	}
	return bytes
}

function timingSafeEqual(left: Uint8Array, right: Uint8Array) {
	if (left.length !== right.length) return false
	let result = 0
	for (let index = 0; index < left.length; index += 1) {
		const leftValue = left[index] ?? 0
		const rightValue = right[index] ?? 0
		result |= leftValue ^ rightValue
	}
	return result === 0
}

async function derivePasswordKey(
	password: string,
	salt: Uint8Array,
	iterations: number,
	length: number,
) {
	const key = await crypto.subtle.importKey(
		'raw',
		new TextEncoder().encode(password),
		'PBKDF2',
		false,
		['deriveBits'],
	)
	const derivedBits = await crypto.subtle.deriveBits(
		{
			name: 'PBKDF2',
			salt: salt as unknown as BufferSource,
			iterations,
			hash: 'SHA-256',
		},
		key,
		length * 8,
	)
	return new Uint8Array(derivedBits)
}

async function hashLegacyPassword(password: string) {
	const data = new TextEncoder().encode(password)
	const hash = await crypto.subtle.digest('SHA-256', data)
	return toHex(new Uint8Array(hash))
}

export async function createPasswordHash(password: string) {
	const salt = crypto.getRandomValues(new Uint8Array(passwordSaltBytes))
	const hash = await derivePasswordKey(
		password,
		salt,
		passwordHashIterations,
		passwordHashBytes,
	)
	return `${passwordHashPrefix}$${passwordHashIterations}$${toHex(salt)}$${toHex(
		hash,
	)}`
}

export async function verifyPassword(
	password: string,
	storedHash: string,
): Promise<{ valid: boolean; upgradedHash?: string }> {
	if (!storedHash) {
		return { valid: false }
	}
	const normalizedHash = storedHash.trim()
	if (normalizedHash.startsWith(`${passwordHashPrefix}$`)) {
		const [prefix, iterationsRaw, saltHex, hashHex, ...extra] =
			normalizedHash.split('$')
		if (prefix !== passwordHashPrefix || extra.length > 0) {
			return { valid: false }
		}
		if (!iterationsRaw) return { valid: false }
		const iterations = Number.parseInt(iterationsRaw, 10)
		const salt = saltHex ? fromHex(saltHex) : null
		const hash = hashHex ? fromHex(hashHex) : null
		if (!iterations || iterations < 1 || !salt || !hash) {
			return { valid: false }
		}
		const derived = await derivePasswordKey(
			password,
			salt,
			iterations,
			hash.length,
		)
		return { valid: timingSafeEqual(derived, hash) }
	}

	if (legacyPasswordHashPattern.test(normalizedHash)) {
		const legacyHash = await hashLegacyPassword(password)
		const valid = timingSafeEqual(
			new TextEncoder().encode(legacyHash),
			new TextEncoder().encode(normalizedHash.toLowerCase()),
		)
		if (valid) {
			return { valid: true, upgradedHash: await createPasswordHash(password) }
		}
	}

	return { valid: false }
}
