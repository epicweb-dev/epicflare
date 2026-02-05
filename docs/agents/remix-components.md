## No React

This application does NOT use React. We use `remix/component` for UI components.
Do not introduce React, Preact, or any other UI framework.

## Remix Components vs React Components

Remix components work differently from React. Here's how:

### Stateless Components

For simple components with no state, return a render function:

```tsx
function Greeting() {
	return ({ name }: { name: string }) => <div>Hello, {name}!</div>
}
```

### Stateful Components

For components that need state, use `handle: Handle` and return a function that
returns JSX. The closure above the return acts as your state container:

```tsx
import type { Handle } from 'remix/component'

function Counter(handle: Handle) {
	// State lives in the closure
	let count = 0

	// Call handle.update() to re-render when state changes
	const increment = () => {
		count++
		handle.update()
	}

	// Return a render function
	return () => (
		<div>
			<span>Count: {count}</span>
			<button on={{ click: increment }}>+</button>
		</div>
	)
}
```

### Components with Props and State

When a component has both props and state, use setup props for initial setup and
render props for rendering.

Important: Always use render props inside the render function to get the latest
prop values. The setup props are captured once at setup time and may be stale.

```tsx
import type { Handle } from 'remix/component'

function UserCard(handle: Handle, setupProps: { userId: string }) {
	let user: User | null = null
	let loading = true

	// Use setup props for initial data fetching
	fetch(`/api/users/${setupProps.userId}`)
		.then((res) => res.json())
		.then((data) => {
			user = data
			loading = false
			handle.update()
		})

	// Render props always has the latest values
	return (renderProps: { userId: string }) => (
		<div>
			<h2>User: {renderProps.userId}</h2>
			{loading ? <span>Loading...</span> : <span>{user?.name}</span>}
		</div>
	)
}
```

### Event Handling

Use `on={{ eventName: handler }}` instead of `onClick`:

```tsx
<button on={{ click: handleClick }}>Click me</button>
<input on={{ input: handleInput, blur: handleBlur }} />
```

### CSS-in-JS

Use the `css` prop for inline styles with pseudo-selector support:

```tsx
<button
	css={{
		padding: '8px 16px',
		backgroundColor: '#3b82f6',
		'&:hover': {
			backgroundColor: '#2563eb',
		},
	}}
>
	Styled Button
</button>
```

### Subscribing to Events

Use `handle.on()` to subscribe to custom events or other event targets:

```tsx
function RouterAware(handle: Handle) {
	handle.on(router, { navigate: () => handle.update() })

	return () => <div>Current path: {location.pathname}</div>
}
```

### Abort Signal

Use `handle.signal` for cancellable async operations:

```tsx
function DataLoader(handle: Handle) {
	let data = null

	fetch('/api/data', { signal: handle.signal })
		.then((res) => res.json())
		.then((d) => {
			data = d
			handle.update()
		})
		.catch((err) => {
			if (handle.signal.aborted) return
			console.error(err)
		})

	return () => <div>{data ? JSON.stringify(data) : 'Loading...'}</div>
}
```

### The `connect` Prop (No refs)

Remix components do not support React-style refs. Instead, use the `connect`
prop to detect when an element has been added to the screen and get a reference
to the DOM node.

```tsx
function MyComponent() {
	return (
		<div
			connect={(node, signal) => {
				console.log('Element added to screen:', node)

				signal.addEventListener('abort', () => {
					console.log('Element removed from screen')
				})
			}}
		>
			Hello World
		</div>
	)
}
```

Key features:

- Automatic cleanup: the AbortSignal is aborted when the element is removed
- Flexible signature: use `(node)` or `(node, signal)` as needed
- Scheduled execution: callback runs after DOM insertion

Example with DOM manipulation:

```tsx
function AutoFocusInput(handle: Handle) {
	return () => (
		<input
			type="text"
			connect={(input: HTMLInputElement) => {
				input.focus()
			}}
		/>
	)
}
```

Example with cleanup:

```tsx
function ResizeAware(handle: Handle) {
	let width = 0

	return () => (
		<div
			connect={(node: HTMLDivElement, signal) => {
				const observer = new ResizeObserver((entries) => {
					width = entries[0].contentRect.width
					handle.update()
				})
				observer.observe(node)

				signal.addEventListener('abort', () => {
					observer.disconnect()
				})
			}}
		>
			Width: {width}px
		</div>
	)
}
```

### Context System

The context system allows indirect ancestor/descendant communication without
passing props through every level. It's accessed via `handle.context`.

Setting context (provider):

```tsx
import type { Handle } from 'remix/component'

function ThemeProvider(handle: Handle<{ theme: 'light' | 'dark' }>) {
	handle.context.set({ theme: 'dark' })

	return () => (
		<div>
			<ThemedButton />
			<ThemedText />
		</div>
	)
}
```

Getting context (consumer):

```tsx
import type { Handle } from 'remix/component'

function ThemedButton(handle: Handle) {
	const theme = handle.context.get(ThemeProvider)

	return () => (
		<button
			css={{
				background: theme?.theme === 'dark' ? '#333' : '#fff',
				color: theme?.theme === 'dark' ? '#fff' : '#333',
			}}
		>
			Click me
		</button>
	)
}
```

Key features:

- Type safety via `Handle<{ ... }>`
- Ancestor lookup finds the nearest provider
- Scoped per provider instance
- Component-keyed lookup using the provider function

Full example with multiple consumers:

```tsx
import type { Handle } from 'remix/component'

function UserProvider(
	handle: Handle<{ user: { name: string; role: string } }>,
) {
	handle.context.set({ user: { name: 'Alice', role: 'admin' } })

	return () => (
		<div>
			<UserGreeting />
			<UserBadge />
		</div>
	)
}

function UserGreeting(handle: Handle) {
	const ctx = handle.context.get(UserProvider)

	return () => <h1>Welcome, {ctx?.user.name}!</h1>
}

function UserBadge(handle: Handle) {
	const ctx = handle.context.get(UserProvider)

	return () => (
		<span
			css={{
				padding: '4px 8px',
				background: ctx?.user.role === 'admin' ? '#ef4444' : '#3b82f6',
				borderRadius: '4px',
				color: 'white',
			}}
		>
			{ctx?.user.role}
		</span>
	)
}
```

### Known Bug: DOM insertBefore Error

There is a known bug in Remix components where navigating with a client-side
router can sometimes cause this console error:

```
Uncaught NotFoundError: Failed to execute 'insertBefore' on 'Node': The node before which the new node is to be inserted is not a child of this node.
```

Workaround: If you see this error while testing, refresh the page. This is a
framework-level issue that does not indicate a problem with your code.
