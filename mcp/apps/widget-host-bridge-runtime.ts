export const widgetHostBridgeRuntime = `
function createWidgetHostBridge(options) {
	const bridgeOptions = options || {}
	const protocolVersion = bridgeOptions.protocolVersion || '2025-11-21'
	const requestTimeoutMs = bridgeOptions.requestTimeoutMs || 1500
	const appInfo = bridgeOptions.appInfo || {
		name: 'mcp-widget',
		version: '1.0.0',
	}
	const renderDataMessageType = 'ui-lifecycle-iframe-render-data'
	const hostContextChangedMethod = 'ui/notifications/host-context-changed'

	let requestCounter = 0
	let initialized = false
	let initializationFailed = false
	let initializationPromise = null
	const pendingRequests = new Map()

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

	function dispatchRenderData(renderData) {
		if (typeof bridgeOptions.onRenderData === 'function') {
			bridgeOptions.onRenderData(renderData)
		}
	}

	function dispatchHostContext(hostContext) {
		if (typeof bridgeOptions.onHostContextChanged === 'function') {
			bridgeOptions.onHostContextChanged(hostContext)
		}
	}

	function handleBridgeResponseMessage(message) {
		if (!message || typeof message !== 'object') return
		if (message.jsonrpc !== '2.0') return
		if (typeof message.id === 'undefined' || message.id === null) return

		const requestId = String(message.id)
		const pendingRequest = pendingRequests.get(requestId)
		if (!pendingRequest) return

		clearTimeout(pendingRequest.timeoutId)
		pendingRequests.delete(requestId)

		if ('error' in message && message.error) {
			pendingRequest.reject(new Error(getBridgeErrorMessage(message.error)))
			return
		}

		pendingRequest.resolve(message)
	}

	function handleLifecycleMessage(message) {
		if (!message || typeof message !== 'object') return

		if (message.type === renderDataMessageType) {
			dispatchRenderData(message.payload?.renderData)
			return
		}

		if (message.method === hostContextChangedMethod) {
			dispatchHostContext(message.params)
		}
	}

	function handleHostMessage(message) {
		handleBridgeResponseMessage(message)
		handleLifecycleMessage(message)
	}

	function sendBridgeRequest(method, params) {
		return new Promise((resolve, reject) => {
			requestCounter += 1
			const requestId = appInfo.name + '-bridge-' + requestCounter
			const timeoutId = setTimeout(() => {
				pendingRequests.delete(requestId)
				reject(new Error('Bridge request timed out'))
			}, requestTimeoutMs)

			pendingRequests.set(requestId, {
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
				pendingRequests.delete(requestId)
				clearTimeout(timeoutId)
				reject(error)
			}
		})
	}

	async function initialize() {
		if (initialized) return true
		if (initializationFailed) return false
		if (initializationPromise) return initializationPromise

		initializationPromise = sendBridgeRequest('ui/initialize', {
			appInfo,
			appCapabilities: {},
			protocolVersion,
		})
			.then((response) => {
				const hostContext = response.result?.hostContext
				dispatchHostContext(hostContext)
				initialized = true
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
			.catch(() => {
				initializationFailed = true
				return false
			})
			.finally(() => {
				initializationPromise = null
			})

		return initializationPromise
	}

	async function sendUserMessage(text) {
		const bridgeReady = await initialize()
		if (!bridgeReady) return false

		try {
			const response = await sendBridgeRequest('ui/message', {
				role: 'user',
				content: [{ type: 'text', text }],
			})
			return !response?.result?.isError
		} catch {
			return false
		}
	}

	async function sendUserMessageWithFallback(text) {
		const bridgeSent = await sendUserMessage(text)
		if (bridgeSent) return true

		try {
			postMessageToHost({
				type: 'prompt',
				payload: { prompt: text },
			})
			return true
		} catch {
			return false
		}
	}

	function requestRenderData() {
		try {
			postMessageToHost({
				type: 'ui-request-render-data',
				payload: {},
			})
			return true
		} catch {
			return false
		}
	}

	return {
		handleHostMessage,
		initialize,
		sendUserMessage,
		sendUserMessageWithFallback,
		requestRenderData,
	}
}
`.trim()
