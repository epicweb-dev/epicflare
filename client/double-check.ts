import { type Handle } from 'remix/component'

type ButtonLikeProps = {
	mix?: Array<unknown>
	onConfirm?: (event: MouseEvent) => void
	on?: {
		click?: (event: MouseEvent) => void
	}
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
			const {
				mix: inputMix,
				onConfirm,
				on: onOverrides,
				...rest
			} = buttonProps as ButtonLikeProps
			const mix = [...(inputMix ?? [])]
			const confirmHandler = onConfirm ?? onOverrides?.click

			mix.push({
				handleEvent(handle) {
					handle.addEventListener('blur', () => {
						setDoubleCheck(false)
					})

					handle.addEventListener('click', (event) => {
						if (!doubleCheck) {
							event.preventDefault()
							setDoubleCheck(true)
							return
						}
						setDoubleCheck(false)
						confirmHandler?.(event)
					})
				},
			})

			return {
				...rest,
				mix,
			}
		},
	}
}
