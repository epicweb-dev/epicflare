export const calculatorUiResourceUri =
	'ui://calculator-app/entry-point.html' as const

const calculatorUiEntryPointHtml = `
<!doctype html>
<html lang="en">
	<head>
		<meta charset="utf-8" />
		<meta name="viewport" content="width=device-width, initial-scale=1" />
		<title>Calculator</title>
		<style>
			:root {
				color-scheme: light dark;
			}

			* {
				box-sizing: border-box;
			}

			body {
				margin: 0;
				padding: 0;
				font-family:
					Inter,
					ui-sans-serif,
					system-ui,
					-apple-system,
					BlinkMacSystemFont,
					'Segoe UI',
					sans-serif;
				background: #0f172a;
				color: #e2e8f0;
			}

			@media (prefers-color-scheme: light) {
				body {
					background: #e2e8f0;
					color: #0f172a;
				}
			}

			.calculator-root {
				width: min(420px, 100vw);
				padding: 1rem;
				display: grid;
				gap: 0.75rem;
				margin: 0 auto;
			}

			.calculator-title {
				margin: 0;
				font-size: 1rem;
				font-weight: 600;
			}

			.calculator-help {
				margin: 0;
				font-size: 0.8rem;
				opacity: 0.82;
			}

			.calculator-display {
				border-radius: 0.75rem;
				padding: 0.75rem;
				background: #1e293b;
				border: 1px solid #334155;
				min-height: 80px;
				display: grid;
				align-content: center;
				gap: 0.25rem;
			}

			@media (prefers-color-scheme: light) {
				.calculator-display {
					background: #f8fafc;
					border-color: #cbd5e1;
				}
			}

			.calculator-expression {
				font-size: 0.85rem;
				min-height: 1rem;
				opacity: 0.75;
				word-break: break-word;
			}

			.calculator-result {
				font-size: 2rem;
				line-height: 1;
				font-variant-numeric: tabular-nums;
				word-break: break-all;
			}

			.calculator-keypad {
				display: grid;
				grid-template-columns: repeat(4, minmax(0, 1fr));
				gap: 0.5rem;
			}

			.calculator-key {
				border: 1px solid #475569;
				background: #1e293b;
				color: inherit;
				padding: 0.75rem;
				border-radius: 0.625rem;
				font-size: 1.05rem;
				cursor: pointer;
			}

			.calculator-key:hover {
				filter: brightness(1.1);
			}

			.calculator-key:active {
				transform: translateY(1px);
			}

			.calculator-key.operator {
				background: #1d4ed8;
				border-color: #1e40af;
				color: #eff6ff;
			}

			.calculator-key.control {
				background: #334155;
			}

			@media (prefers-color-scheme: light) {
				.calculator-key {
					background: #f8fafc;
					border-color: #cbd5e1;
				}

				.calculator-key.control {
					background: #e2e8f0;
				}
			}
		</style>
	</head>
	<body>
		<section class="calculator-root" data-calculator-ui>
			<header>
				<h1 class="calculator-title">Calculator</h1>
				<p class="calculator-help">Use keys, Enter, and Backspace.</p>
			</header>

			<div class="calculator-display" role="status" aria-live="polite">
				<div class="calculator-expression" data-expression>&nbsp;</div>
				<div class="calculator-result" data-result>0</div>
			</div>

			<div class="calculator-keypad" role="group" aria-label="Calculator keypad">
				<button class="calculator-key control" data-action="clear" type="button">C</button>
				<button class="calculator-key control" data-action="backspace" type="button">BS</button>
				<button class="calculator-key operator" data-action="operator" data-value="/" type="button">/</button>
				<button class="calculator-key operator" data-action="operator" data-value="*" type="button">*</button>

				<button class="calculator-key" data-action="digit" data-value="7" type="button">7</button>
				<button class="calculator-key" data-action="digit" data-value="8" type="button">8</button>
				<button class="calculator-key" data-action="digit" data-value="9" type="button">9</button>
				<button class="calculator-key operator" data-action="operator" data-value="-" type="button">-</button>

				<button class="calculator-key" data-action="digit" data-value="4" type="button">4</button>
				<button class="calculator-key" data-action="digit" data-value="5" type="button">5</button>
				<button class="calculator-key" data-action="digit" data-value="6" type="button">6</button>
				<button class="calculator-key operator" data-action="operator" data-value="+" type="button">+</button>

				<button class="calculator-key" data-action="digit" data-value="1" type="button">1</button>
				<button class="calculator-key" data-action="digit" data-value="2" type="button">2</button>
				<button class="calculator-key" data-action="digit" data-value="3" type="button">3</button>
				<button class="calculator-key operator" data-action="evaluate" type="button">=</button>

				<button class="calculator-key" data-action="digit" data-value="0" type="button" style="grid-column: span 2">
					0
				</button>
				<button class="calculator-key" data-action="decimal" type="button">.</button>
				<button class="calculator-key control" data-action="reset" type="button">AC</button>
			</div>
		</section>

		<script>
			;(function () {
				const expressionElement = document.querySelector('[data-expression]')
				const resultElement = document.querySelector('[data-result]')
				const keyElements = Array.from(document.querySelectorAll('[data-action]'))

				if (!expressionElement || !resultElement) {
					return
				}

				const state = {
					leftOperand: null,
					operator: null,
					displayValue: '0',
					waitingForNextOperand: false,
					expressionText: '',
				}

				function formatNumber(value) {
					if (!Number.isFinite(value)) return 'Error'
					return Number(value.toPrecision(12)).toString()
				}

				function compute(left, operator, right) {
					if (operator === '+') return left + right
					if (operator === '-') return left - right
					if (operator === '*') return left * right
					if (operator === '/') {
						if (right === 0) return null
						return left / right
					}
					return right
				}

				function updateView() {
					expressionElement.textContent = state.expressionText || ' '
					resultElement.textContent = state.displayValue
				}

				function resetAll() {
					state.leftOperand = null
					state.operator = null
					state.displayValue = '0'
					state.waitingForNextOperand = false
					state.expressionText = ''
					updateView()
				}

				function setError() {
					state.leftOperand = null
					state.operator = null
					state.displayValue = 'Error'
					state.waitingForNextOperand = true
					state.expressionText = 'Invalid operation'
					updateView()
				}

				function addDigit(digit) {
					if (state.displayValue === 'Error' || state.waitingForNextOperand) {
						state.displayValue = digit
						state.waitingForNextOperand = false
						updateView()
						return
					}

					state.displayValue =
						state.displayValue === '0'
							? digit
							: state.displayValue + digit
					updateView()
				}

				function addDecimal() {
					if (state.displayValue === 'Error' || state.waitingForNextOperand) {
						state.displayValue = '0.'
						state.waitingForNextOperand = false
						updateView()
						return
					}

					if (!state.displayValue.includes('.')) {
						state.displayValue += '.'
						updateView()
					}
				}

				function removeLastCharacter() {
					if (state.displayValue === 'Error' || state.waitingForNextOperand) {
						state.displayValue = '0'
						state.waitingForNextOperand = false
						updateView()
						return
					}

					state.displayValue = state.displayValue.slice(0, -1) || '0'
					updateView()
				}

				function useOperator(nextOperator) {
					const inputValue = Number(state.displayValue)
					if (!Number.isFinite(inputValue)) {
						setError()
						return
					}

					if (state.operator && state.waitingForNextOperand) {
						state.operator = nextOperator
						state.expressionText = formatNumber(state.leftOperand) + ' ' + nextOperator
						updateView()
						return
					}

					if (state.leftOperand === null || state.operator === null) {
						state.leftOperand = inputValue
					} else {
						const result = compute(state.leftOperand, state.operator, inputValue)
						if (result === null) {
							setError()
							return
						}
						state.leftOperand = result
						state.displayValue = formatNumber(result)
					}

					state.operator = nextOperator
					state.waitingForNextOperand = true
					state.expressionText = formatNumber(state.leftOperand) + ' ' + nextOperator
					updateView()
				}

				function evaluateExpression() {
					if (
						state.operator === null ||
						state.leftOperand === null ||
						state.waitingForNextOperand
					) {
						return
					}

					const rightOperand = Number(state.displayValue)
					const result = compute(state.leftOperand, state.operator, rightOperand)
					if (result === null) {
						setError()
						return
					}

					const expression =
						formatNumber(state.leftOperand) +
						' ' +
						state.operator +
						' ' +
						formatNumber(rightOperand)

					state.displayValue = formatNumber(result)
					state.leftOperand = result
					state.operator = null
					state.waitingForNextOperand = true
					state.expressionText = expression + ' ='
					updateView()
				}

				function handleAction(action, value) {
					if (action === 'digit' && value) return addDigit(value)
					if (action === 'decimal') return addDecimal()
					if (action === 'operator' && value) return useOperator(value)
					if (action === 'evaluate') return evaluateExpression()
					if (action === 'clear') {
						state.displayValue = '0'
						state.waitingForNextOperand = false
						updateView()
						return
					}
					if (action === 'backspace') return removeLastCharacter()
					if (action === 'reset') return resetAll()
				}

				for (const keyElement of keyElements) {
					keyElement.addEventListener('click', () => {
						handleAction(
							keyElement.getAttribute('data-action'),
							keyElement.getAttribute('data-value'),
						)
					})
				}

				document.addEventListener('keydown', (event) => {
					if (event.key >= '0' && event.key <= '9') {
						event.preventDefault()
						addDigit(event.key)
						return
					}
					if (event.key === '.') {
						event.preventDefault()
						addDecimal()
						return
					}
					if (event.key === 'Enter' || event.key === '=') {
						event.preventDefault()
						evaluateExpression()
						return
					}
					if (
						event.key === '+' ||
						event.key === '-' ||
						event.key === '*' ||
						event.key === '/'
					) {
						event.preventDefault()
						useOperator(event.key)
						return
					}
					if (event.key === 'Backspace') {
						event.preventDefault()
						removeLastCharacter()
						return
					}
					if (event.key.toLowerCase() === 'c') {
						event.preventDefault()
						resetAll()
					}
				})

				updateView()
			})()
		</script>
	</body>
</html>
`.trim()

export function renderCalculatorUiEntryPoint() {
	return calculatorUiEntryPointHtml
}
