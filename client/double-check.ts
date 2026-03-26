import { on, type Handle } from 'remix/component'


type ButtonLikeProps = {
	mix?: Array<unknown>
	[key: string]: unknown
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
		getButtonProps<Props extends ButtonLikeProps>(props?: Props): Props {
			const buttonProps = props ?? ({} as Props)
			const mix = [...(buttonProps.mix ?? [])]

			mix.push(
				on<HTMLButtonElement, 'blur'>('blur', () => {
					setDoubleCheck(false)
				}),
			)

			mix.push(
				on<HTMLButtonElement, 'click'>('click', (event) => {
					if (!doubleCheck) {
						event.preventDefault()
						setDoubleCheck(true)
						return
					}
					setDoubleCheck(false)
				}),
			)

			return {
				...buttonProps,
				mix,
			}
		},
	}
}
