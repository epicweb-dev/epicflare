import { css, on } from 'remix/component'
import { jsx as remixJsx } from 'remix/component/jsx-runtime'

type CompatEventMap = Record<
	string,
	(event: Event, signal: AbortSignal) => void | Promise<void>
>

type CSSProps = Record<string, unknown>

type CompatProps = Record<string, unknown> & {
	css?: CSSProps
	mix?: unknown
	on?: CompatEventMap
}

function normalizeMix(value: unknown) {
	if (value == null) return []
	return Array.isArray(value) ? [...value] : [value]
}

function normalizeProps(props: unknown) {
	if (!props || typeof props !== 'object') {
		return props as Record<string, unknown> | undefined
	}

	const input = props as CompatProps
	const { css: cssProp, mix: mixProp, on: onProp, ...rest } = input
	const mix = normalizeMix(mixProp)

	if (cssProp) {
		mix.push(css(cssProp as never))
	}

	if (onProp) {
		for (const [eventName, listener] of Object.entries(onProp)) {
			mix.push(on(eventName as never, listener as never))
		}
	}

	if (mix.length > 0) {
		return {
			...rest,
			mix,
		}
	}

	return rest
}

export function jsx(type: string | Function, props: unknown, key?: string) {
	const normalizedProps = normalizeProps(props) ?? {}
	// Not createElement: its `...children` rest overwrites `props.children` when only (type, props) is passed.
	return remixJsx(type as never, normalizedProps as never, key as never)
}

export const jsxs = jsx
export const jsxDEV = jsx
