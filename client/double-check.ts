import {
	on,
	type ElementProps,
	type Handle,
	type MixinDescriptor,
} from 'remix/ui'

type BlurHandler = (event: FocusEvent) => void
type ClickHandler = (event: MouseEvent) => void
type ButtonMixin = MixinDescriptor<HTMLButtonElement, any, ElementProps>

type ButtonLikeProps = {
	on?: {
		blur?: BlurHandler
		click?: ClickHandler
	}
	mix?: ButtonMixin | Array<ButtonMixin | null | undefined> | null
	[key: string]: unknown
}

function callAll<Event>(
	...handlers: Array<((event: Event) => void) | undefined>
) {
	return (event: Event) => {
		for (const handler of handlers) {
			handler?.(event)
		}
	}
}

function normalizeMix(
	mix: ButtonLikeProps['mix'],
): Array<ButtonMixin | null | undefined> {
	if (!mix) return []
	return Array.isArray(mix) ? [...mix] : [mix]
}

export function createDoubleCheck(handle: Handle) {
	let doubleCheck = false

	function setDoubleCheck(nextValue: boolean) {
		if (doubleCheck === nextValue) return
		doubleCheck = nextValue
		handle.update()
	}

	return {
		get doubleCheck() {
			return doubleCheck
		},
		reset() {
			setDoubleCheck(false)
		},
		getButtonProps(props: ButtonLikeProps = {}) {
			const buttonProps = props
			const { on: handlers, mix, ...rest } = buttonProps

			const onBlur: BlurHandler = () => {
				setDoubleCheck(false)
			}

			const onClick: ClickHandler = (event) => {
				if (!doubleCheck) {
					event.preventDefault()
					setDoubleCheck(true)
					return
				}

				handlers?.click?.(event)
				setDoubleCheck(false)
			}

			return {
				...rest,
				mix: [
					...normalizeMix(mix),
					on<HTMLButtonElement, 'blur'>(
						'blur',
						callAll(onBlur, handlers?.blur),
					),
					on<HTMLButtonElement, 'click'>('click', onClick),
				],
			}
		},
	}
}
