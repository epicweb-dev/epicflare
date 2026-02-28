export const calculatorUiResourceUri =
	'ui://calculator-app/entry-point.html' as const

const appStylesheetHrefPlaceholder = '__APP_STYLESHEET_HREF__'

const calculatorUiEntryPointTemplate = `
<!doctype html>
<html lang="en">
	<head>
		<meta charset="utf-8" />
		<meta name="viewport" content="width=device-width, initial-scale=1" />
		<title>Calculator</title>
		<link rel="stylesheet" href="${appStylesheetHrefPlaceholder}" />
		<style>
			:root {
				color-scheme: light dark;
			}

			:root[data-theme='light'] {
				color-scheme: light;
			}

			:root[data-theme='dark'] {
				color-scheme: dark;
			}

			* {
				box-sizing: border-box;
			}

			body {
				margin: 0;
				padding: var(--spacing-md);
				font-family: var(--font-family);
				font-size: var(--font-size-base);
				color: var(--color-text);
				background: var(--color-background);
			}

			.calculator-root {
				width: min(100%, 28rem);
				margin: 0 auto;
				padding: var(--spacing-lg);
				display: grid;
				gap: var(--spacing-md);
				border-radius: var(--radius-lg);
				border: 1px solid var(--color-border);
				background-color: var(--color-surface);
				box-shadow: var(--shadow-sm);
			}

			.calculator-title {
				margin: 0;
				font-size: var(--font-size-lg);
				font-weight: var(--font-weight-semibold);
				color: var(--color-text);
			}

			.calculator-help {
				margin: 0;
				font-size: var(--font-size-sm);
				color: var(--color-text-muted);
			}

			.calculator-display {
				border-radius: var(--radius-md);
				padding: var(--spacing-md);
				background: color-mix(
					in srgb,
					var(--color-background) 72%,
					var(--color-surface)
				);
				border: 1px solid var(--color-border);
				min-height: 80px;
				display: grid;
				align-content: center;
				gap: var(--spacing-xs);
			}

			.calculator-expression {
				font-size: var(--font-size-sm);
				min-height: 1rem;
				color: var(--color-text-muted);
				word-break: break-word;
			}

			.calculator-result {
				font-size: var(--font-size-xl);
				line-height: 1;
				font-variant-numeric: tabular-nums;
				word-break: break-all;
				color: var(--color-text);
			}

			.calculator-keypad {
				display: grid;
				grid-template-columns: repeat(4, minmax(0, 1fr));
				gap: var(--spacing-sm);
			}

			.calculator-key {
				border: 1px solid var(--color-border);
				background-color: var(--color-background);
				color: var(--color-text);
				padding: var(--spacing-sm);
				border-radius: var(--radius-md);
				font-family: var(--font-family);
				font-size: var(--font-size-base);
				font-weight: var(--font-weight-medium);
				cursor: pointer;
				transition:
					transform var(--transition-fast),
					background-color var(--transition-normal),
					color var(--transition-normal),
					border-color var(--transition-normal);
			}

			.calculator-key:hover:not(:disabled) {
				background-color: color-mix(
					in srgb,
					var(--color-surface) 78%,
					var(--color-primary) 22%
				);
				transform: translateY(-1px);
			}

			.calculator-key:active {
				transform: translateY(1px);
			}

			.calculator-key:focus-visible {
				outline: 2px solid var(--color-primary);
				outline-offset: 1px;
			}

			.calculator-key.operator {
				background-color: var(--color-primary);
				border-color: transparent;
				color: var(--color-on-primary);
				font-weight: var(--font-weight-semibold);
			}

			.calculator-key.operator:hover:not(:disabled) {
				background-color: var(--color-primary-hover);
			}

			.calculator-key.operator:active {
				background-color: var(--color-primary-active);
			}

			.calculator-key.control,
			.calculator-key.utility {
				background-color: var(--color-surface);
			}

			.calculator-key.span-two {
				grid-column: span 2;
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

				<button class="calculator-key span-two" data-action="digit" data-value="0" type="button">
					0
				</button>
				<button class="calculator-key" data-action="decimal" type="button">.</button>
				<button class="calculator-key utility" data-action="reset" type="button">AC</button>
			</div>
		</section>

		<script>
			;(function () {
				const rootElement = document.documentElement
				const expressionElement = document.querySelector('[data-expression]')
				const resultElement = document.querySelector('[data-result]')
				const keyElements = Array.from(document.querySelectorAll('[data-action]'))
				const renderDataMessageType = 'ui-lifecycle-iframe-render-data'
				const hostContextChangedMethod = 'ui/notifications/host-context-changed'
				const mcpProtocolVersion = '2025-11-21'
				const bridgeRequestTimeoutMs = 1500
				const mcpAppInfo = {
					name: 'calculator-widget',
					version: '1.0.0',
				}
				let bridgeRequestCounter = 0
				let bridgeInitialized = false
				let bridgeInitializationPromise = null
				const pendingBridgeRequests = new Map()

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

				function postMessageToHost(message) {
					window.parent.postMessage(message, '*')
				}

				function getBridgeErrorMessage(error) {
					if (
						typeof error === 'object' &&
						error !== null &&
						typeof error.message === 'string'
					) {
						return error.message
					}
					return 'Bridge request failed'
				}

				function handleBridgeResponseMessage(message) {
					if (!message || typeof message !== 'object') return
					if (message.jsonrpc !== '2.0') return
					if (typeof message.id === 'undefined' || message.id === null) return

					const requestId = String(message.id)
					const pendingRequest = pendingBridgeRequests.get(requestId)
					if (!pendingRequest) return

					clearTimeout(pendingRequest.timeoutId)
					pendingBridgeRequests.delete(requestId)

					if ('error' in message && message.error) {
						pendingRequest.reject(new Error(getBridgeErrorMessage(message.error)))
						return
					}

					pendingRequest.resolve(message)
				}

				function sendBridgeRequest(method, params) {
					return new Promise((resolve, reject) => {
						bridgeRequestCounter += 1
						const requestId = 'calculator-bridge-' + bridgeRequestCounter
						const timeoutId = setTimeout(() => {
							pendingBridgeRequests.delete(requestId)
							reject(new Error('Bridge request timed out'))
						}, bridgeRequestTimeoutMs)

						pendingBridgeRequests.set(requestId, {
							resolve,
							reject,
							timeoutId,
						})

						try {
							postMessageToHost({
								jsonrpc: '2.0',
								id: requestId,
								method,
								params,
							})
						} catch (error) {
							pendingBridgeRequests.delete(requestId)
							clearTimeout(timeoutId)
							reject(error)
						}
					})
				}

				function initializeHostBridge() {
					if (bridgeInitialized) return Promise.resolve(true)
					if (bridgeInitializationPromise) return bridgeInitializationPromise

					bridgeInitializationPromise = sendBridgeRequest('ui/initialize', {
						appInfo: mcpAppInfo,
						appCapabilities: {},
						protocolVersion: mcpProtocolVersion,
					})
						.then((response) => {
							const hostTheme = response.result?.hostContext?.theme
							applyTheme(hostTheme)
							bridgeInitialized = true
							try {
								postMessageToHost({
									jsonrpc: '2.0',
									method: 'ui/notifications/initialized',
									params: {},
								})
							} catch {
								// Ignore initialized notification failures and continue.
							}
							return true
						})
						.catch(() => false)
						.finally(() => {
							bridgeInitializationPromise = null
						})

					return bridgeInitializationPromise
				}

				async function sendPromptToHost(prompt) {
					const bridgeReady = await initializeHostBridge()
					if (bridgeReady) {
						try {
							const response = await sendBridgeRequest('ui/message', {
								role: 'user',
								content: [{ type: 'text', text: prompt }],
							})
							if (!response?.result?.isError) {
								return true
							}
						} catch {
							// Fall through to compatibility fallback.
						}
					}

					try {
						postMessageToHost({
							type: 'prompt',
							payload: { prompt },
						})
						return true
					} catch {
						// Ignore host messaging errors; calculator behavior should still work locally.
						return false
					}
				}

				function sendResultToHostAgent(expression, resultValue) {
					const prompt = 'Calculator result: ' + expression + ' = ' + resultValue
					void sendPromptToHost(prompt)
				}

				function applyTheme(theme) {
					if (theme === 'dark' || theme === 'light') {
						rootElement.setAttribute('data-theme', theme)
						return
					}
					rootElement.removeAttribute('data-theme')
				}

				function applyThemeFromHostMessage(message) {
					if (!message || typeof message !== 'object') return
					if (message.type === renderDataMessageType) {
						const theme = message.payload?.renderData?.theme
						applyTheme(theme)
						return
					}
					if (message.method === hostContextChangedMethod) {
						applyTheme(message.params?.theme)
					}
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
						if (!Number.isFinite(result)) {
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
					if (!Number.isFinite(result)) {
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
					sendResultToHostAgent(expression, state.displayValue)
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
					if (event.key.toLowerCase() === 'c' && !event.ctrlKey && !event.metaKey) {
						event.preventDefault()
						handleAction('clear')
					}
				})

				window.addEventListener('message', (event) => {
					const message = event.data
					if (!message || typeof message !== 'object') return
					handleBridgeResponseMessage(message)
					applyThemeFromHostMessage(message)
				})

				try {
					window.parent.postMessage(
						{
							type: 'ui-request-render-data',
							payload: {},
						},
						'*',
					)
				} catch {
					// Ignore render-data request failures outside MCP hosts.
				}

				updateView()
			})()
		</script>
	</body>
</html>
`.trim()

type RenderCalculatorUiEntryPointOptions = {
	stylesheetHref?: string
}

function escapeHtmlAttribute(value: string) {
	return value
		.replaceAll('&', '&amp;')
		.replaceAll('"', '&quot;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
}

export function renderCalculatorUiEntryPoint(
	options: RenderCalculatorUiEntryPointOptions = {},
) {
	const stylesheetHref = options.stylesheetHref ?? '/styles.css'
	return calculatorUiEntryPointTemplate.replace(
		appStylesheetHrefPlaceholder,
		escapeHtmlAttribute(stylesheetHref),
	)
}
