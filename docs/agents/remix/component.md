# component

Source: https://github.com/remix-run/remix/tree/main/packages/component

## README

A minimal component system that leans on JavaScript and DOM primitives.

## Features

- **JSX Runtime** - Convenient JSX syntax
- **Component State** - State managed with plain JavaScript variables
- **Manual Updates** - Explicit control over when components update via
  `handle.update()`
- **Real DOM Events** - Events are real DOM events using
  [`@remix-run/interaction`](../interaction)
- **Inline CSS** - CSS prop with pseudo-selectors and nested rules

## Installation

```sh
npm install @remix-run/component
```

## Getting Started

Create a root and render a component:

```tsx
import { createRoot } from '@remix-run/component'

function App(handle: Handle) {
	let count = 0
	return () => (
		<button
			on={{
				click: () => {
					count++
					handle.update()
				},
			}}
		>
			Count: {count}
		</button>
	)
}

createRoot(document.body).render(<App />)
```

Components are functions that receive a `Handle` as their first argument. They
must return a render function that receives props.

## Component State and Updates

State is managed with plain JavaScript variables. Call `handle.update()` to
schedule an update:

```tsx
function Counter(handle: Handle) {
	let count = 0

	return () => (
		<div>
			<span>Count: {count}</span>
			<button
				on={{
					click: () => {
						count++
						handle.update()
					},
				}}
			>
				Increment
			</button>
		</div>
	)
}
```

## Components

All components return a render function. The setup function runs **once** when
the component is first created, and the returned render function runs on the
first render and **every update** afterward:

```tsx
function Counter(handle: Handle, setup: number) {
	// Setup phase: runs once
	let count = setup

	// Return render function: runs on every update
	return (props: { label?: string }) => (
		<div>
			{props.label || 'Count'}: {count}
			<button
				on={{
					click: () => {
						count++
						handle.update()
					},
				}}
			>
				Increment
			</button>
		</div>
	)
}
```

### Setup Prop vs Props

When a component returns a function, it has two phases:

1. **Setup phase** - The component function receives the `setup` prop and runs
   once. Use this for initialization.
2. **Render phase** - The returned function receives props and runs on initial
   render and every update afterward. Use this for rendering.

The `setup` prop is separate from regular props. Only the `setup` prop is passed
to the setup function, and only props are passed to the render function.

- `setup` prop for values that initialize state (e.g., `initial`,
  `defaultValue`)
- Regular props for values that change over time (e.g., `label`, `disabled`)

```tsx
// Usage: setup prop goes to setup function, regular props go to render function
let el = <Counter setup={5} label="Total" />

function Counter(
	handle: Handle,
	setup: number, // receives 5 (the setup prop value)
) {
	let count = setup // use setup for initialization

	return (props: { label?: string }) => {
		// props only receives { label: "Total" } - not the setup prop
		return (
			<div>
				{props.label}: {count}
			</div>
		)
	}
}
```

## Events

Events use the `on` prop and are handled by
[`@remix-run/interaction`](../interaction). Listeners receive an `AbortSignal`
that's aborted when the component is disconnected or the handler is re-entered.

```tsx
function SearchInput(handle: Handle) {
	let query = ''

	return () => (
		<input
			type="text"
			value={query}
			on={{
				input: (event, signal) => {
					query = event.currentTarget.value
					handle.update()

					// Pass the signal to abort the fetch on re-entry or node removal
					// This avoids race conditions in the UI and manages cleanup
					fetch(`/search?q=${query}`, { signal })
						.then((res) => res.json())
						.then((results) => {
							if (signal.aborted) return
							// Update results
						})
				},
			}}
		/>
	)
}
```

You can also listen to global event targets like `document` or `window` using
`handle.on()` with automatic cleanup on component removal:

```tsx
function KeyboardTracker(handle: Handle) {
	let keys: string[] = []

	handle.on(document, {
		keydown: (event) => {
			keys.push(event.key)
			handle.update()
		},
	})

	return () => <div>Keys: {keys.join(', ')}</div>
}
```

## CSS Prop

Use the `css` prop for inline styles with pseudo-selectors and nested rules:

```tsx
function Button(handle: Handle) {
	return () => (
		<button
			css={{
				color: 'white',
				backgroundColor: 'blue',
				'&:hover': {
					backgroundColor: 'darkblue',
				},
				'&:active': {
					transform: 'scale(0.98)',
				},
			}}
		>
			Click me
		</button>
	)
}
```

The syntax mirrors modern CSS nesting, but in object form. Use `&` to reference
the current element in pseudo-selectors, pseudo-elements, and attribute
selectors. Use class names or other selectors directly for child selectors:

```css
.button {
	color: white;
	background-color: blue;

	&:hover {
		background-color: darkblue;
	}

	&::before {
		content: '';
		position: absolute;
	}

	&[aria-selected='true'] {
		border: 2px solid yellow;
	}

	.icon {
		width: 16px;
		height: 16px;
	}

	@media (max-width: 768px) {
		padding: 8px;
	}
}
```

```tsx
function Button(handle: Handle) {
	return () => (
		<button
			css={{
				color: 'white',
				backgroundColor: 'blue',
				'&:hover': {
					backgroundColor: 'darkblue',
				},
				'&::before': {
					content: '""',
					position: 'absolute',
				},
				'&[aria-selected="true"]': {
					border: '2px solid yellow',
				},
				'.icon': {
					width: '16px',
					height: '16px',
				},
				'@media (max-width: 768px)': {
					padding: '8px',
				},
			}}
		>
			<span className="icon">*</span>
			Click me
		</button>
	)
}
```

## Connect Prop

Use the `connect` prop to get a reference to the DOM node after it's rendered.
This is useful for DOM operations like focusing elements, scrolling, or
measuring dimensions.

```tsx
function Form(handle: Handle) {
	let inputRef: HTMLInputElement

	return () => (
		<form>
			<input
				type="text"
				// get the input node
				connect={(node) => (inputRef = node)}
			/>
			<button
				on={{
					click: () => {
						// Select it from other parts of the form
						inputRef.select()
					},
				}}
			>
				Focus Input
			</button>
		</form>
	)
}
```

The `connect` callback can optionally receive an `AbortSignal` as a second
parameter, which is aborted when the element is removed from the DOM:

```tsx
function Component(handle: Handle) {
	return () => (
		<div
			connect={(node, signal) => {
				// Set up something that needs cleanup
				let observer = new ResizeObserver(() => {
					// handle resize
				})
				observer.observe(node)

				// Clean up when element is removed
				signal.addEventListener('abort', () => {
					observer.disconnect()
				})
			}}
		>
			Content
		</div>
	)
}
```

## Component Handle API

Components receive a `Handle` as their first argument with the following API:

- **`handle.update(task?)`** - Schedule an update. Optionally provide a task to
  run after the update.
- **`handle.queueTask(task)`** - Schedule a task to run after the next update.
  Useful for DOM operations that need to happen after rendering (e.g., moving
  focus, scrolling, measuring elements, etc.).
- **`handle.on(target, listeners)`** - Listen to an event target with automatic
  cleanup when the component disconnects.
- **`handle.signal`** - An `AbortSignal` that's aborted when the component is
  disconnected. Useful for cleanup.
- **`handle.id`** - Stable identifier per component instance.
- **`handle.context`** - Context API for ancestor/descendant communication.

### `handle.update(task?)`

Schedule an update. Optionally provide a task to run after the update completes.

```tsx
function Counter(handle: Handle) {
	let count = 0

	return () => (
		<button
			on={{
				click: () => {
					count++
					handle.update()
				},
			}}
		>
			Count: {count}
		</button>
	)
}
```

You can pass a task to run after the update:

```tsx
function Player(handle: Handle) {
	let isPlaying = false
	let playButton: HTMLButtonElement
	let stopButton: HTMLButtonElement

	return () => (
		<div>
			<button
				disabled={isPlaying}
				connect={(node) => (playButton = node)}
				on={{
					click: () => {
						isPlaying = true
						handle.update(() => {
							// Focus the enabled button after update completes
							stopButton.focus()
						})
					},
				}}
			>
				Play
			</button>
			<button
				disabled={!isPlaying}
				connect={(node) => (stopButton = node)}
				on={{
					click: () => {
						isPlaying = false
						handle.update(() => {
							// Focus the enabled button after update completes
							playButton.focus()
						})
					},
				}}
			>
				Stop
			</button>
		</div>
	)
}
```

### `handle.queueTask(task)`

Schedule a task to run after the next update. Useful for DOM operations that
need to happen after rendering (e.g., moving focus, scrolling, measuring
elements).

```tsx
function Form(handle: Handle) {
	let showDetails = false
	let detailsSection: HTMLElement

	return () => (
		<form>
			<label>
				<input
					type="checkbox"
					checked={showDetails}
					on={{
						change: (event) => {
							showDetails = event.currentTarget.checked
							handle.update()
							if (showDetails) {
								// Scroll to the expanded section after it renders
								handle.queueTask(() => {
									detailsSection.scrollIntoView({
										behavior: 'smooth',
										block: 'start',
									})
								})
							}
						},
					}}
				/>
				Show additional details
			</label>
			{showDetails && (
				<section
					connect={(node) => (detailsSection = node)}
					css={{
						marginTop: '2rem',
						padding: '1rem',
						border: '1px solid #ccc',
					}}
				>
					<h2>Additional Details</h2>
					<p>This section appears when the checkbox is checked.</p>
				</section>
			)}
		</form>
	)
}
```

### `handle.on(target, listeners)`

Listen to an
[EventTarget](https://developer.mozilla.org/en-US/docs/Web/API/EventTarget) with
automatic cleanup when the component disconnects. Ideal for listening to events
on global event targets like `document` and `window`.

```tsx
function KeyboardTracker(handle: Handle) {
	let keys: string[] = []

	handle.on(document, {
		keydown: (event) => {
			keys.push(event.key)
			handle.update()
		},
	})

	return () => <div>Keys: {keys.join(', ')}</div>
}
```

The listeners are automatically removed when the component is disconnected, so
you don't need to manually clean up.

### `handle.signal`

An `AbortSignal` that's aborted when the component is disconnected. Useful for
cleanup operations.

```tsx
function Clock(handle: Handle) {
	let interval = setInterval(() => {
		// clear the interval when the component is disconnected
		if (handle.signal.aborted) {
			clearInterval(interval)
			return
		}
		handle.update()
	}, 1000)
	return () => <span>{new Date().toString()}</span>
}
```

### `handle.id`

Stable identifier per component instance. Useful for HTML APIs like `htmlFor`,
`aria-owns`, etc. so consumers don't have to supply an id.

```tsx
function LabeledInput(handle: Handle) {
	return () => (
		<div>
			<label htmlFor={handle.id}>Name</label>
			<input id={handle.id} type="text" />
		</div>
	)
}
```

### `handle.context`

Context API for ancestor/descendant communication. All components are potential
context providers and consumers. Use `handle.context.set()` to provide values
and `handle.context.get()` to consume them.

```tsx
function App(handle: Handle<{ theme: string }>) {
	handle.context.set({ theme: 'dark' })

	return () => (
		<div>
			<Header />
			<Content />
		</div>
	)
}

function Header(handle: Handle) {
	// Consume context from App
	let { theme } = handle.context.get(App)
	return () => (
		<header
			css={{
				backgroundColor: theme === 'dark' ? '#000' : '#fff',
			}}
		>
			Header
		</header>
	)
}
```

Setting context values does not automatically trigger updates. If a provider
needs to render its own context values, call `handle.update()` after setting
them. However, since providers often don't render context values themselves,
calling `update()` can cause expensive updates of the entire subtree. Instead,
make your context an
[EventTarget](https://developer.mozilla.org/en-US/docs/Web/API/EventTarget) and
have consumers subscribe to changes.

```tsx
import { TypedEventTarget } from '@remix-run/interaction'

class Theme extends TypedEventTarget<{ change: Event }> {
	#value: 'light' | 'dark' = 'light'

	get value() {
		return this.#value
	}

	setValue(value: string) {
		this.#value = value
		this.dispatchEvent(new Event('change'))
	}
}

function App(handle: Handle<Theme>) {
	let theme = new Theme()
	handle.context.set(theme)

	return () => (
		<div>
			<button
				on={{
					click: () => {
						// no updates in the parent component
						theme.setValue(theme.value === 'light' ? 'dark' : 'light')
					},
				}}
			>
				Toggle Theme
			</button>
			<ThemedContent />
		</div>
	)
}

function ThemedContent(handle: Handle) {
	let theme = handle.context.get(App)

	// Subscribe to theme changes and update when it changes
	handle.on(theme, { change: () => handle.update() })

	return () => (
		<div css={{ backgroundColor: theme.value === 'dark' ? '#000' : '#fff' }}>
			Current theme: {theme.value}
		</div>
	)
}
```

## Fragments

Use `Fragment` to group elements without adding extra DOM nodes:

```tsx
function List(handle: Handle) {
	return () => (
		<>
			<li>Item 1</li>
			<li>Item 2</li>
			<li>Item 3</li>
		</>
	)
}
```

## Wrapping Components

- use `Props<'div'>`
- use `RemixNode` not JSX.Element, etc.

## Future

This package is a work in progress. Future features (demo'd at Remix Jam)
include:

- Server Rendering
- Selective Hydration
- `<Frame>` for streamable, reloadable partial server UI

See [LICENSE](https://github.com/remix-run/remix/blob/main/LICENSE)

## Component Docs

### Getting Started (getting-started.md)

Create interactive UIs with Remix Component using a two-phase component model:
setup runs once, render runs on every update.

#### Creating a Root

To start using Remix Component, create a root and render your top-level
component:

```tsx
import { createRoot } from '@remix-run/component'
import type { Handle } from '@remix-run/component'

function App(handle: Handle) {
	return () => <div>Hello, World!</div>
}

// Create a root attached to a DOM element
let container = document.getElementById('app')!
let root = createRoot(container)

// Render your app
root.render(<App />)
```

The `createRoot` function takes a DOM element (or `document.body`) and returns a
root object with a `render` method. You can call `render` multiple times to
update the app:

```tsx
function App(handle: Handle) {
	let count = 0

	return () => (
		<div>
			<div>Count: {count}</div>
			<button
				on={{
					click() {
						count++
						handle.update()
					},
				}}
			>
				Increment
			</button>
		</div>
	)
}

let root = createRoot(document.body)
root.render(<App />)

// Later, you can update the app by calling render again
// root.render(<App />)
```

#### Root Methods

The root object provides several methods:

- **`render(node)`** - Renders a component tree into the root container
- **`flush()`** - Synchronously flushes all pending updates and tasks
- **`remove()`** - Removes the component tree and cleans up

```tsx
let root = createRoot(document.body)

// Render initial app
root.render(<App />)

// Flush any pending updates synchronously
root.flush()

// Later, remove the app
root.remove()
```

#### Next Steps

- [Components](./components.md) - Component structure and runtime behavior
- [Handle API](./handle.md) - The component's interface to the framework
- [Styling](./styling.md) - CSS prop for inline styling
- [Events](./events.md) - Event handling patterns

### Components (components.md)

All components follow a consistent two-phase structure.

#### Component Structure

1. **Setup Phase** - Runs once when the component is first created
2. **Render Phase** - Runs on initial render and every update afterward

```tsx
function MyComponent(handle: Handle, setup: SetupType) {
	// Setup phase: runs once
	let state = initializeState(setup)

	// Return render function: runs on every update
	return (props: Props) => {
		return <div>{/* render content */}</div>
	}
}
```

#### Runtime Behavior

When a component is rendered:

1. **First Render**:

- The component function is called with `handle` and the `setup` prop
- The returned render function is stored
- The render function is called with regular props
- Any tasks queued via `handle.queueTask()` are executed after rendering

2. **Subsequent Updates**:

- Only the render function is called
- Setup phase is skipped, setup closure persists for the lifetime of the
  component instance
- Props are passed to the render function
- The `setup` prop is stripped from props
- Tasks queued during the update are executed after rendering

3. **Component Removal**:

- `handle.signal` is aborted
- All event listeners registered via `handle.on()` are automatically cleaned up
- Any queued tasks are executed with an aborted signal

#### Setup vs Props

The `setup` prop is special - it's only available in the setup phase and is
automatically excluded from props. This prevents accidental stale captures:

```tsx
function Counter(handle: Handle, setup: number) {
	// setup prop (e.g., initialCount) only available here
	let count = setup

	return (props: { label: string }) => {
		// props only receives { label } - setup is excluded
		return (
			<div>
				{props.label}: {count}
			</div>
		)
	}
}

// Usage
let element = <Counter setup={5} label="Clicks" />
```

#### Basic Rendering

The simplest component just returns JSX:

```tsx
function Greeting() {
	return (props: { name: string }) => <div>Hello, {props.name}!</div>
}

let el = <Greeting name="Remix" />
```

#### Prop Passing

Props flow from parent to child through JSX attributes:

```tsx
function Parent() {
	return () => <Child message="Hello" count={3} />
}

function Child() {
	return (props: { message: string; count: number }) => (
		<div>
			<div>{props.message}</div>
			<div>Count: {props.count}</div>
		</div>
	)
}
```

#### Stateful Updates

State is managed with plain JavaScript variables. Call `handle.update()` to
trigger a re-render:

```tsx
function Counter(handle: Handle) {
	let count = 0

	return () => (
		<div>
			<div>Count: {count}</div>
			<button
				on={{
					click() {
						count++
						handle.update()
					},
				}}
			>
				Increment
			</button>
		</div>
	)
}
```

#### See Also

- [Handle API](./handle.md) - Complete handle API reference
- [Patterns](./patterns.md) - State management best practices

### Composition (composition.md)

Building component trees with props, children, refs, and keys.

#### Props

Props flow from parent to child through JSX attributes:

```tsx
function Parent() {
	return () => <Child message="Hello" count={3} />
}

function Child() {
	return (props: { message: string; count: number }) => (
		<div>
			<div>{props.message}</div>
			<div>Count: {props.count}</div>
		</div>
	)
}
```

#### Children

Components can compose other components via `children`:

```tsx
function Layout() {
	return (props: { children: RemixNode }) => (
		<div>
			<header>My App</header>
			<main>{props.children}</main>
			<footer>(c) 2024</footer>
		</div>
	)
}

function App() {
	return () => (
		<Layout>
			<h1>Welcome</h1>
			<p>Content goes here</p>
		</Layout>
	)
}
```

#### Connect Prop

Use the `connect` prop to get a reference to the DOM node after it's rendered.
This is useful for DOM operations like focusing elements, scrolling, measuring
dimensions, or setting up observers.

```tsx
function Form(handle: Handle) {
	let inputRef: HTMLInputElement

	return () => (
		<form>
			<input connect={(node) => (inputRef = node)} />
			<button
				on={{
					click(event) {
						event.preventDefault()
						inputRef.focus()
					},
				}}
			>
				Focus Input
			</button>
		</form>
	)
}
```

The `connect` callback can optionally receive an `AbortSignal` as a second
parameter, which is aborted when the element is removed from the DOM. Use this
for cleanup operations:

```tsx
function ResizeTracker(handle: Handle) {
	let dimensions = { width: 0, height: 0 }

	return () => (
		<div
			connect={(node, signal) => {
				// Set up ResizeObserver
				let observer = new ResizeObserver((entries) => {
					let entry = entries[0]
					if (entry) {
						dimensions.width = Math.round(entry.contentRect.width)
						dimensions.height = Math.round(entry.contentRect.height)
						handle.update()
					}
				})
				observer.observe(node)

				// Clean up when element is removed
				signal.addEventListener('abort', () => {
					observer.disconnect()
				})
			}}
		>
			Size: {dimensions.width} x {dimensions.height}
		</div>
	)
}
```

The `connect` callback is called only once when the element is first rendered,
not on every update.

#### Key Prop

Use the `key` prop to uniquely identify elements in lists. Keys enable efficient
diffing and preserve DOM nodes and component state when lists are reordered,
filtered, or updated.

```tsx
function TodoList(handle: Handle) {
	let todos = [
		{ id: '1', text: 'Buy milk' },
		{ id: '2', text: 'Walk dog' },
		{ id: '3', text: 'Write code' },
	]

	return () => (
		<ul>
			{todos.map((todo) => (
				<li key={todo.id}>{todo.text}</li>
			))}
		</ul>
	)
}
```

When you reorder, add, or remove items, keys ensure:

- **DOM nodes are reused** - Elements with matching keys are moved, not
  recreated
- **Component state is preserved** - Component instances persist across reorders
- **Focus and selection are maintained** - Input focus stays with the same
  element
- **Input values are preserved** - Form values remain with their elements

```tsx
function ReorderableList(handle: Handle) {
	let items = [
		{ id: 'a', label: 'Item A' },
		{ id: 'b', label: 'Item B' },
		{ id: 'c', label: 'Item C' },
	]

	function reverse() {
		items = [...items].reverse()
		handle.update()
	}

	return () => (
		<div>
			<button on={{ click: reverse }}>Reverse List</button>
			<ul>
				{items.map((item) => (
					<li key={item.id}>
						<input defaultValue={item.label} />
					</li>
				))}
			</ul>
		</div>
	)
}
```

Even when the list order changes, each input maintains its value and focus state
because the `key` prop identifies which DOM node corresponds to which item.

Keys can be any type (string, number, bigint, object, symbol), but should be
stable and unique within the list:

```tsx
// Good: stable, unique IDs
{
	items.map((item) => <div key={item.id} />)
}

// Good: index can work if list never reorders
{
	items.map((item, index) => <div key={index} />)
}

// Bad: don't use random values or values that change
{
	items.map((item) => <div key={Math.random()} />)
}
```

#### See Also

- [Context](./context.md) - Indirect composition without prop drilling
- [Animate API](./animate.md) - Keys are required for animation reclamation

### Handle API (handle.md)

The `Handle` object provides the component's interface to the framework.

#### `handle.update(task?)`

Schedules a component update. Optionally accepts a task to run after the update
completes.

```tsx
function Counter(handle: Handle) {
	let count = 0

	return () => (
		<button
			on={{
				click() {
					count++
					handle.update()
				},
			}}
		>
			Count: {count}
		</button>
	)
}
```

With a task:

```tsx
function Player(handle: Handle) {
	let isPlaying = false
	let stopButton: HTMLButtonElement

	return () => (
		<button
			on={{
				click() {
					isPlaying = true
					handle.update(() => {
						// Task runs after update completes
						stopButton.focus()
					})
				},
			}}
		>
			Play
		</button>
	)
}
```

#### `handle.queueTask(task)`

Schedules a task to run after the next update. The task receives an
`AbortSignal` that's aborted when:

- The component re-renders (new render cycle starts)
- The component is removed from the tree

**Use `queueTask` in event handlers when work needs to happen after DOM
changes:**

```tsx
function Form(handle: Handle) {
	let showDetails = false
	let detailsSection: HTMLElement

	return () => (
		<div>
			<button
				on={{
					click() {
						showDetails = true
						handle.update()
						handle.queueTask(() => {
							detailsSection.scrollIntoView({ behavior: 'smooth' })
						})
					},
				}}
			>
				Show Details
			</button>
			{showDetails && (
				<div connect={(node) => (detailsSection = node)}>Details content</div>
			)}
		</div>
	)
}
```

**Use `queueTask` for work that needs to be reactive to prop changes:**

When you need to perform async work (like data fetching) that should respond to
prop changes, use `queueTask` in the render function. The signal will be aborted
if props change or the component is removed, ensuring only the latest work
completes.

##### Anti-patterns

**Don't create states as values to "react to" on the next render with
`queueTask`:**

```tsx
// BAD: Creating state just to react to it in queueTask
function BadExample(handle: Handle) {
	let shouldLoad = false // Unnecessary state

	return () => (
		<button
			on={{
				click() {
					shouldLoad = true
					handle.update()
					handle.queueTask(() => {
						if (shouldLoad) {
							// Do work
						}
					})
				},
			}}
		>
			Load
		</button>
	)
}

// GOOD: Do the work directly in the event handler or queueTask
function GoodExample(handle: Handle) {
	return () => (
		<button
			on={{
				click() {
					handle.queueTask(() => {
						// Do work directly - no intermediate state needed
					})
				},
			}}
		>
			Load
		</button>
	)
}
```

**Don't call `handle.update()` before async work in a task:**

The task's signal is aborted when the component re-renders. If you call
`handle.update()` before your async work completes, the re-render will abort the
signal you're using for the async operation:

```tsx
// BAD: Calling handle.update() before async work
function BadAsyncExample(handle: Handle) {
	let data: string[] = []
	let loading = false

	handle.queueTask(async (signal) => {
		loading = true
		handle.update() // This triggers a re-render, which aborts signal!

		let response = await fetch('/api/data', { signal }) // AbortError: signal is aborted
		if (signal.aborted) return

		data = await response.json()
		loading = false
		handle.update()
	})

	return () => <div>{loading ? 'Loading...' : data.join(', ')}</div>
}

// GOOD: Set initial state in setup, only call handle.update() after async work
function GoodAsyncExample(handle: Handle) {
	let data: string[] = []
	let loading = true // Start in loading state

	handle.queueTask(async (signal) => {
		let response = await fetch('/api/data', { signal })
		if (signal.aborted) return

		data = await response.json()
		loading = false
		handle.update() // Safe - async work is complete
	})

	return () => <div>{loading ? 'Loading...' : data.join(', ')}</div>
}
```

#### `handle.signal`

An `AbortSignal` that's aborted when the component is disconnected. Useful for
cleanup operations.

```tsx
function Clock(handle: Handle) {
	let interval = setInterval(() => {
		if (handle.signal.aborted) {
			clearInterval(interval)
			return
		}
		handle.update()
	}, 1000)

	return () => <div>{new Date().toString()}</div>
}
```

Or using event listeners:

```tsx
function Clock(handle: Handle) {
	let interval = setInterval(handle.update, 1000)
	handle.signal.addEventListener('abort', () => clearInterval(interval))

	return () => <div>{new Date().toString()}</div>
}
```

#### `handle.on(target, listeners)`

Listen to an `EventTarget` with automatic cleanup when the component
disconnects. Ideal for global event targets like `document` and `window`.

```tsx
function KeyboardTracker(handle: Handle) {
	let keys: string[] = []

	handle.on(document, {
		keydown(event) {
			keys.push(event.key)
			handle.update()
		},
	})

	return () => <div>Keys: {keys.join(', ')}</div>
}
```

#### `handle.id`

Stable identifier per component instance. Useful for HTML APIs like `htmlFor`,
`aria-owns`, etc.

```tsx
function LabeledInput(handle: Handle) {
	return () => (
		<div>
			<label htmlFor={handle.id}>Name</label>
			<input id={handle.id} />
		</div>
	)
}
```

#### `handle.context`

Context API for ancestor/descendant communication. See [Context](./context.md)
for full documentation.

```tsx
function App(handle: Handle<{ theme: string }>) {
	handle.context.set({ theme: 'dark' })

	return () => (
		<div>
			<Header />
		</div>
	)
}

function Header(handle: Handle) {
	let { theme } = handle.context.get(App)
	return () => <div>Header</div>
}
```

**Important:** `handle.context.set()` does not cause any updates - it simply
stores a value. If you need the component tree to update when context changes,
call `handle.update()` after setting the context.

#### See Also

- [Events](./events.md) - Event handling patterns with signals
- [Context](./context.md) - Context API with TypedEventTarget
- [Patterns](./patterns.md) - Common usage patterns

### Events (events.md)

Event handling with the `on` prop and signal-based interruption management.

#### Basic Event Handling

Use the `on` prop to attach event listeners to elements:

```tsx
function Button(handle: Handle) {
	let count = 0

	return () => (
		<button
			on={{
				click() {
					count++
					handle.update()
				},
			}}
		>
			Clicked {count} times
		</button>
	)
}
```

#### Event Handler Signature

Event handlers receive the event object and an optional `AbortSignal`:

```tsx
on={{
  click(event) {
    // event is the DOM event
    event.preventDefault()
  },
  async input(event, signal) {
    // signal is aborted when handler is re-entered or component removed
    let response = await fetch('/api', { signal })
  }
}}
```

#### Signals in Event Handlers

Event handlers receive an `AbortSignal` that's automatically aborted when:

- The handler is re-entered (user triggers another event before the previous one
  completes)
- The component is removed from the tree

This prevents race conditions when users create events faster than async work
completes:

```tsx
function SearchInput(handle: Handle) {
	let results: string[] = []
	let loading = false

	return () => (
		<div>
			<input
				type="text"
				on={{
					async input(event, signal) {
						let query = event.currentTarget.value
						loading = true
						handle.update()

						// Passing signal automatically aborts previous requests
						let response = await fetch(`/search?q=${query}`, { signal })
						let data = await response.json()
						// Manual check for APIs that don't accept a signal
						if (signal.aborted) return

						results = data.results
						loading = false
						handle.update()
					},
				}}
			/>
			{loading && <div>Loading...</div>}
			{!loading && results.length > 0 && (
				<ul>
					{results.map((result, i) => (
						<li key={i}>{result}</li>
					))}
				</ul>
			)}
		</div>
	)
}
```

The signal ensures only the latest search request completes, preventing stale
results from overwriting newer ones.

#### Multiple Event Types

Handle multiple events on the same element:

```tsx
function InteractiveBox(handle: Handle) {
	let state = 'idle'

	return () => (
		<div
			on={{
				mouseenter() {
					state = 'hovered'
					handle.update()
				},
				mouseleave() {
					state = 'idle'
					handle.update()
				},
				click() {
					state = 'clicked'
					handle.update()
				},
			}}
		>
			State: {state}
		</div>
	)
}
```

#### Form Events

Common form event patterns:

```tsx
function Form(handle: Handle) {
	return () => (
		<form
			on={{
				submit(event) {
					event.preventDefault()
					let formData = new FormData(event.currentTarget)
					// Process form data
				},
			}}
		>
			<input
				name="email"
				on={{
					blur(event) {
						// Validate on blur
						let value = event.currentTarget.value
						if (!value.includes('@')) {
							event.currentTarget.setCustomValidity('Invalid email')
						}
					},
					input(event) {
						// Clear validation on input
						event.currentTarget.setCustomValidity('')
					},
				}}
			/>
			<button type="submit">Submit</button>
		</form>
	)
}
```

#### Keyboard Events

Handle keyboard interactions:

```tsx
function KeyboardNav(handle: Handle) {
	let selectedIndex = 0
	let items = ['Apple', 'Banana', 'Cherry']

	return () => (
		<ul
			tabIndex={0}
			on={{
				keydown(event) {
					switch (event.key) {
						case 'ArrowDown':
							event.preventDefault()
							selectedIndex = Math.min(selectedIndex + 1, items.length - 1)
							handle.update()
							break
						case 'ArrowUp':
							event.preventDefault()
							selectedIndex = Math.max(selectedIndex - 1, 0)
							handle.update()
							break
					}
				},
			}}
		>
			{items.map((item, i) => (
				<li
					key={i}
					css={{
						backgroundColor: i === selectedIndex ? '#eee' : 'transparent',
					}}
				>
					{item}
				</li>
			))}
		</ul>
	)
}
```

#### Global Event Listeners

Use `handle.on()` for global event targets with automatic cleanup:

```tsx
function WindowResizeTracker(handle: Handle) {
	let width = window.innerWidth
	let height = window.innerHeight

	// Set up global listeners once in setup
	handle.on(window, {
		resize() {
			width = window.innerWidth
			height = window.innerHeight
			handle.update()
		},
	})

	return () => (
		<div>
			Window size: {width} x {height}
		</div>
	)
}
```

```tsx
function KeyboardTracker(handle: Handle) {
	let keys: string[] = []

	handle.on(document, {
		keydown(event) {
			keys.push(event.key)
			handle.update()
		},
	})

	return () => <div>Keys: {keys.join(', ')}</div>
}
```

#### Best Practices

##### Prefer Press Events Over Click

For interactive elements, prefer `press` events over `click`. Press events
provide better cross-device behavior:

- Fire on both mouse and touch interactions
- Handle keyboard activation (Enter/Space) automatically
- Prevent ghost clicks on touch devices
- Support press-and-hold patterns

```tsx
// BAD: click doesn't handle all interaction modes well
<button on={{ click() { doAction() } }}>Action</button>

// GOOD: press handles mouse, touch, and keyboard uniformly
<button on={{ press() { doAction() } }}>Action</button>
```

Use `click` only when you specifically need mouse-click behavior (e.g.,
detecting right-clicks or modifier keys).

##### Do Work in Event Handlers

Do as much work as possible in event handlers. Use the event handler scope for
transient state:

```tsx
// GOOD: Do work in handler, only store what renders need
function SearchResults(handle: Handle) {
	let results: string[] = [] // Needed for rendering
	let loading = false // Needed for rendering loading state

	return () => (
		<div>
			<input
				on={{
					async input(event, signal) {
						let query = event.currentTarget.value
						// Do work in handler scope
						loading = true
						handle.update()

						let response = await fetch(`/search?q=${query}`, { signal })
						let data = await response.json()
						if (signal.aborted) return

						// Only store what's needed for rendering
						results = data.results
						loading = false
						handle.update()
					},
				}}
			/>
			{loading && <div>Loading...</div>}
			{results.map((result, i) => (
				<div key={i}>{result}</div>
			))}
		</div>
	)
}
```

##### Always Check signal.aborted

For async work, always check the signal or pass it to APIs that support it:

```tsx
on={{
  async click(event, signal) {
    // Option 1: Pass signal to fetch
    let response = await fetch('/api', { signal })

    // Option 2: Manual check after await
    let data = await someAsyncOperation()
    if (signal.aborted) return

    // Safe to update state
    handle.update()
  }
}}
```

#### See Also

- [Handle API](./handle.md) - `handle.on()` for global listeners
- [Patterns](./patterns.md) - Data loading and async patterns

### Custom Interactions (interactions.md)

Build reusable interaction patterns with the `@remix-run/interaction` package.

> **Note:** Custom interactions are rare in application code. Most apps should
> use the built-in interactions (`press`, `longPress`, `swipe`, etc.) and
> standard DOM events. Only create custom interactions when you need to
> encapsulate complex multi-event patterns that will be reused across your
> codebase.

#### Built-in Interactions

The interaction package provides several ready-to-use interactions:

```tsx
import {
	press,
	pressDown,
	pressUp,
	longPress,
	pressCancel,
} from '@remix-run/interaction/press'
import {
	swipeStart,
	swipeMove,
	swipeEnd,
	swipeCancel,
} from '@remix-run/interaction/swipe'
import {
	arrowUp,
	arrowDown,
	arrowLeft,
	arrowRight,
	space,
} from '@remix-run/interaction/keys'
```

Use them like any event type:

```tsx
<button
	on={{
		[press]() {
			doAction()
		},
	}}
>
	Action
</button>
```

#### When to Create Custom Interactions

Create a custom interaction when:

- You need to combine multiple low-level events into a semantic action
- The interaction pattern will be reused across multiple components
- You want to encapsulate complex state tracking (e.g., gesture recognition,
  tempo detection)

Don't create a custom interaction when:

- A built-in interaction already handles your use case
- The logic is simple enough to handle inline in an event handler
- The pattern is only used in one place

#### Defining an Interaction

Use `defineInteraction` to create a reusable interaction:

```ts
import { defineInteraction, type Interaction } from '@remix-run/interaction'

// 1. Define the interaction with a unique namespaced type
export let dragRelease = defineInteraction('myapp:drag-release', DragRelease)

// 2. Declare the event type for TypeScript
declare global {
	interface HTMLElementEventMap {
		[dragRelease]: DragReleaseEvent
	}
}

// 3. Create a custom event class with relevant data
export class DragReleaseEvent extends Event {
	velocityX: number
	velocityY: number

	constructor(
		type: typeof dragRelease,
		init: { velocityX: number; velocityY: number },
	) {
		super(type, { bubbles: true, cancelable: true })
		this.velocityX = init.velocityX
		this.velocityY = init.velocityY
	}
}

// 4. Implement the interaction setup function
function DragRelease(handle: Interaction) {
	if (!(handle.target instanceof HTMLElement)) return

	let target = handle.target
	let isTracking = false
	let velocityX = 0
	let velocityY = 0

	handle.on(target, {
		pointerdown(event) {
			if (!event.isPrimary) return
			isTracking = true
			target.setPointerCapture(event.pointerId)
		},

		pointermove(event) {
			if (!isTracking) return
			// Track velocity...
		},

		pointerup(event) {
			if (!isTracking) return
			isTracking = false

			// Dispatch the custom event
			target.dispatchEvent(
				new DragReleaseEvent(dragRelease, { velocityX, velocityY }),
			)
		},
	})
}
```

#### The Interaction Handle

The setup function receives an `Interaction` handle with:

- **`handle.target`** - The element the interaction is attached to
- **`handle.signal`** - AbortSignal for cleanup when the interaction is disposed
- **`handle.on(target, listeners)`** - Add event listeners with automatic
  cleanup
- **`handle.raise(error)`** - Report errors to the parent error handler

```ts
function MyInteraction(handle: Interaction) {
	// Guard for specific element types if needed
	if (!(handle.target instanceof HTMLElement)) return

	let target = handle.target

	// Set up listeners - automatically cleaned up when signal aborts
	handle.on(target, {
		pointerdown(event) {
			// Handle event...
		},
	})

	// Listen to other targets (e.g., document for global events)
	handle.on(target.ownerDocument, {
		pointerup() {
			// Handle pointer released outside target...
		},
	})
}
```

#### Consuming in Components

Use custom interactions just like built-in events:

```tsx
import { dragRelease } from './drag-release.ts'

function DraggableCard(handle: Handle) {
	return () => (
		<div
			on={{
				[dragRelease]() {
					/* ... */
				},
			}}
		>
			Drag me
		</div>
	)
}
```

#### Example: Tap Tempo

A more complex example that tracks repeated taps to calculate BPM:

```ts
import { defineInteraction, type Interaction } from '@remix-run/interaction'

export let tempo = defineInteraction('myapp:tempo', Tempo)

declare global {
	interface HTMLElementEventMap {
		[tempo]: TempoEvent
	}
}

export class TempoEvent extends Event {
	bpm: number

	constructor(type: typeof tempo, bpm: number) {
		super(type)
		this.bpm = bpm
	}
}

function Tempo(handle: Interaction) {
	if (!(handle.target instanceof HTMLElement)) return

	let target = handle.target
	let taps: number[] = []
	let resetTimer = 0

	function handleTap() {
		clearTimeout(resetTimer)

		taps.push(Date.now())
		taps = taps.filter((tap) => Date.now() - tap < 4000)

		if (taps.length >= 4) {
			let intervals = []
			for (let i = 1; i < taps.length; i++) {
				intervals.push(taps[i] - taps[i - 1])
			}
			let avgMs = intervals.reduce((sum, v) => sum + v, 0) / intervals.length
			let bpm = Math.round(60000 / avgMs)
			target.dispatchEvent(new TempoEvent(tempo, bpm))
		}

		resetTimer = window.setTimeout(() => {
			taps = []
		}, 4000)
	}

	handle.on(target, {
		pointerdown: handleTap,
		keydown(event) {
			if (event.repeat) return
			if (event.key === 'Enter' || event.key === ' ') {
				handleTap()
			}
		},
	})
}
```

#### Best Practices

1. **Namespace your event types** - Use a prefix like `myapp:` to avoid
   collisions with built-in interactions
2. **Use cancelable events** - Set `cancelable: true` so consumers can call
   `event.preventDefault()`
3. **Include relevant data** - Add properties to your event class for data
   consumers need
4. **Guard element types** - Check `handle.target instanceof HTMLElement` if you
   need DOM-specific APIs
5. **Clean up automatically** - Use `handle.on()` instead of `addEventListener`
   for automatic cleanup

#### See Also

- [Events](./events.md) - Event handling basics
- [Handle API](./handle.md) - `handle.on()` for global listeners in components

### Context (context.md)

Context enables components to communicate without direct prop passing.

#### Basic Context

Use `handle.context.set()` to provide values and `handle.context.get()` to
consume them:

```tsx
function ThemeProvider(handle: Handle<{ theme: 'light' | 'dark' }>) {
	let theme: 'light' | 'dark' = 'light'

	handle.context.set({ theme })

	return (props: { children: RemixNode }) => (
		<div>
			<button
				on={{
					click() {
						theme = theme === 'light' ? 'dark' : 'light'
						handle.context.set({ theme })
						handle.update()
					},
				}}
			>
				Toggle Theme
			</button>
			{props.children}
		</div>
	)
}

function ThemedContent(handle: Handle) {
	let { theme } = handle.context.get(ThemeProvider)

	return () => <div>Current theme: {theme}</div>
}
```

**Important:** `handle.context.set()` does not cause any updates - it simply
stores a value. If you want the component tree to update when context changes,
you must call `handle.update()` after setting the context (as shown above).

#### TypedEventTarget for Granular Updates

For better performance, use `TypedEventTarget` to avoid updating the entire
subtree. This allows descendants to subscribe to specific changes rather than
re-rendering on every parent update:

```tsx
import { TypedEventTarget } from '@remix-run/interaction'

class Theme extends TypedEventTarget<{ change: Event }> {
	#value: 'light' | 'dark' = 'light'

	get value() {
		return this.#value
	}

	setValue(value: 'light' | 'dark') {
		this.#value = value
		this.dispatchEvent(new Event('change'))
	}
}

function ThemeProvider(handle: Handle) {
	let theme = new Theme()
	handle.context.set(theme)

	return (props: { children: RemixNode }) => (
		<div>
			<button
				on={{
					click() {
						theme.setValue(theme.value === 'light' ? 'dark' : 'light')
					},
				}}
			>
				Toggle Theme
			</button>
			{props.children}
		</div>
	)
}

function ThemedContent(handle: Handle) {
	let theme = handle.context.get(ThemeProvider)

	// Subscribe to granular updates
	handle.on(theme, {
		change() {
			handle.update()
		},
	})

	return () => <div>Current theme: {theme.value}</div>
}
```

Benefits of this pattern:

- **No unnecessary re-renders**: Only components that subscribe to changes are
  updated
- **Decoupled updates**: The provider doesn't need to call `handle.update()`
  when context changes
- **Type-safe events**: `TypedEventTarget` ensures event handlers receive the
  correct event types

#### Context with Multiple Values

Provide multiple related values through context:

```tsx
class AppContext extends TypedEventTarget<{
	userChange: Event
	settingsChange: Event
}> {
	#user: User | null = null
	#settings: Settings = defaultSettings

	get user() {
		return this.#user
	}

	get settings() {
		return this.#settings
	}

	setUser(user: User | null) {
		this.#user = user
		this.dispatchEvent(new Event('userChange'))
	}

	setSettings(settings: Settings) {
		this.#settings = settings
		this.dispatchEvent(new Event('settingsChange'))
	}
}

function AppProvider(handle: Handle) {
	let context = new AppContext()
	handle.context.set(context)

	return (props: { children: RemixNode }) => props.children
}

// Components can subscribe to only the events they care about
function UserDisplay(handle: Handle) {
	let context = handle.context.get(AppProvider)

	handle.on(context, {
		userChange() {
			handle.update()
		},
	})

	return () => <div>{context.user?.name ?? 'Not logged in'}</div>
}
```

#### See Also

- [Handle API](./handle.md) - `handle.context` reference
- [Events](./events.md) - `handle.on()` for subscribing to EventTargets

### Styling (styling.md)

The `css` prop provides inline styling with support for pseudo-selectors,
pseudo-elements, attribute selectors, descendant selectors, and media queries.
It follows modern CSS nesting selector rules.

#### Basic CSS Prop

```tsx
function Button() {
	return () => (
		<button
			css={{
				backgroundColor: '#222',
				color: 'white',
				padding: '8px 12px',
				borderRadius: 6,
			}}
		>
			Click me
		</button>
	)
}
```

#### CSS Prop vs Style Prop

The `css` prop produces static styles that are inserted into the document as CSS
rules, while the `style` prop applies styles directly to the element. For
**dynamic styles** that change frequently, use the `style` prop for better
performance:

```tsx
// BAD: Using css prop for dynamic styles
function ProgressBar(handle: Handle) {
	let progress = 0

	return () => (
		<div
			css={{
				width: `${progress}%`,
				backgroundColor: 'green',
			}}
		>
			{progress}%
		</div>
	)
}

// GOOD: Using style prop for dynamic styles
function ProgressBar(handle: Handle) {
	let progress = 0

	return () => (
		<div
			style={{
				width: `${progress}%`,
				backgroundColor: 'green',
			}}
		>
			{progress}%
		</div>
	)
}
```

**Use the `css` prop for:**

- Static styles that don't change
- Styles that need pseudo-selectors (`:hover`, `:focus`, etc.)
- Styles that need media queries

**Use the `style` prop for:**

- Dynamic styles that change based on state or props
- Computed values that update frequently

#### Pseudo-Selectors

Use `&` to reference the current element in pseudo-selectors:

```tsx
function Button() {
	return () => (
		<button
			css={{
				backgroundColor: '#333',
				color: 'white',
				'&:hover': {
					backgroundColor: '#444',
				},
				'&:focus': {
					outline: '2px solid #66f',
				},
			}}
		>
			Click me
		</button>
	)
}
```

#### Pseudo-Elements

Use `&::before` and `&::after` for pseudo-elements:

```tsx
function Badge() {
	return (props: { count: number }) => (
		<div
			css={{
				position: 'relative',
				padding: '4px 8px',
				'&::after': {
					content: `"${props.count}"`,
					position: 'absolute',
					top: -4,
					right: -4,
					backgroundColor: 'red',
					color: 'white',
					borderRadius: 999,
					padding: '2px 6px',
					fontSize: 10,
				},
			}}
		>
			Notifications
		</div>
	)
}
```

#### Attribute Selectors

Use `&[attribute]` for attribute selectors:

```tsx
function Input() {
	return (props: { required?: boolean }) => (
		<input
			required={props.required}
			css={{
				border: '1px solid #ccc',
				'&[required]': {
					borderColor: 'red',
				},
			}}
		/>
	)
}
```

#### Descendant Selectors

Use class names or element selectors directly for descendant selectors:

```tsx
function Card() {
	return (props: { children: RemixNode }) => (
		<div
			css={{
				padding: 16,
				border: '1px solid #ddd',
				'.title': {
					fontWeight: 600,
				},
				p: {
					margin: 0,
				},
			}}
		>
			<div className="title">Title</div>
			{props.children}
		</div>
	)
}
```

#### When to Use Nested Selectors

Use nested selectors when **parent state affects children**. Don't nest when you
can style the element directly.

**This is preferable to creating JavaScript state and passing it around.**
Instead of managing hover/focus state in JavaScript and passing it as props, use
CSS nested selectors to let the browser handle state transitions declaratively.

**Use nested selectors when:**

1. **Parent state affects children** - Parent hover/focus/state changes child
   styling (prefer this over JavaScript state management)
2. **Styling descendant elements** - Avoid duplicating styles on every child or
   creating new components just for styling

**Don't nest when:**

- Styling the element's own pseudo-states (hover, focus, etc.)
- The element controls its own styling

**Example: Parent hover affects children** (use nested selectors, not JavaScript
state):

```tsx
// BAD: Managing hover state in JavaScript
function CardWithJSState(handle: Handle) {
	let isHovered = false

	return (props: { children: RemixNode }) => (
		<div
			on={{
				mouseenter() {
					isHovered = true
					handle.update()
				},
				mouseleave() {
					isHovered = false
					handle.update()
				},
			}}
			css={{
				border: '1px solid #ddd',
			}}
		>
			<div
				style={{
					color: isHovered ? '#333' : '#888',
				}}
			>
				Title
			</div>
			{props.children}
		</div>
	)
}

// GOOD: CSS nested selectors handle state declaratively
function Card(handle: Handle) {
	return (props: { children: RemixNode }) => (
		<div
			css={{
				border: '1px solid #ddd',
				'&:hover .title': {
					color: '#333',
				},
			}}
		>
			<div className="title">Title</div>
			{props.children}
		</div>
	)
}
```

**Example: Element's own hover** (style directly, no nesting needed):

```tsx
function Button() {
	return () => (
		<button
			css={{
				backgroundColor: '#444',
				color: 'white',
				'&:hover': {
					backgroundColor: '#555',
				},
			}}
		>
			Hover me
		</button>
	)
}
```

#### Media Queries

Use `@media` for responsive design:

```tsx
function ResponsiveGrid() {
	return (props: { children: RemixNode }) => (
		<div
			css={{
				display: 'grid',
				gap: 12,
				gridTemplateColumns: 'repeat(4, 1fr)',
				'@media (max-width: 900px)': {
					gridTemplateColumns: 'repeat(2, 1fr)',
				},
				'@media (max-width: 600px)': {
					gridTemplateColumns: 'repeat(1, 1fr)',
				},
			}}
		>
			{props.children}
		</div>
	)
}
```

#### Complete Example

Here's a comprehensive example demonstrating parent-state-affecting-children and
media queries:

```tsx
function ProductCard() {
	return (props: { title: string; price: number; image: string }) => (
		<div
			css={{
				border: '1px solid #eee',
				borderRadius: 8,
				overflow: 'hidden',
				'&:hover .title': {
					color: '#333',
				},
			}}
		>
			<img src={props.image} alt={props.title} />
			<div css={{ padding: 12 }}>
				<div className="title" css={{ fontSize: 18, fontWeight: 600 }}>
					{props.title}
				</div>
				<div css={{ color: '#666' }}>${props.price}</div>
				<button
					css={{
						marginTop: 8,
						backgroundColor: '#111',
						color: 'white',
						padding: '6px 10px',
						'&:active': {
							transform: 'scale(0.98)',
						},
						'@media (max-width: 600px)': {
							width: '100%',
						},
					}}
				>
					Add to Cart
				</button>
			</div>
		</div>
	)
}
```

This example demonstrates:

- **Parent hover affecting children**: Card hover changes title color and button
  background
- **Styles on elements themselves**: Each element has its own `css` prop
- **Element's own states**: Button's `:active` state styled directly on the
  button
- **Media queries**: Responsive adjustments applied directly to elements

#### See Also

- [Spring API](./spring.md) - Physics-based animation easing
- [Animate API](./animate.md) - Declarative enter/exit/layout animations

### Patterns (patterns.md)

Common patterns and best practices for building components.

#### State Management

##### Use Minimal Component State

Only store state that's needed for rendering. Derive computed values instead of
storing them, and avoid storing input state that you don't need.

**Derive computed values:**

```tsx
// BAD: Storing computed values
function TodoList(handle: Handle) {
	let todos: string[] = []
	let completedCount = 0 // Unnecessary state

	return () => (
		<div>
			{todos.map((todo, i) => (
				<div key={i}>{todo}</div>
			))}
			<div>Completed: {completedCount}</div>
		</div>
	)
}

// GOOD: Derive computed values in render
function TodoList(handle: Handle) {
	let todos: Array<{ text: string; completed: boolean }> = []

	return () => {
		// Derive computed value in render
		let completedCount = todos.filter((t) => t.completed).length

		return (
			<div>
				{todos.map((todo, i) => (
					<div key={i}>{todo.text}</div>
				))}
				<div>Completed: {completedCount}</div>
			</div>
		)
	}
}
```

**Don't store input state you don't need:**

```tsx
// BAD: Storing input value when you only need it on submit
function SearchForm(handle: Handle) {
	let query = '' // Unnecessary state

	return () => (
		<form>
			<input
				value={query}
				on={{
					input(event) {
						query = event.currentTarget.value
						handle.update()
					},
				}}
			/>
			<button type="submit">Search</button>
		</form>
	)
}

// GOOD: Read input value directly from the form
function SearchForm(handle: Handle) {
	return () => (
		<form
			on={{
				submit(event) {
					event.preventDefault()
					let formData = new FormData(event.currentTarget)
					let query = formData.get('query')
				},
			}}
		>
			<input name="query" />
			<button type="submit">Search</button>
		</form>
	)
}
```

##### Do Work in Event Handlers

Do as much work as possible in event handlers with minimal component state. Use
the event handler scope for transient event state, and only capture to component
state if it's used for rendering.

```tsx
// GOOD: Store state that affects rendering
function Toggle(handle: Handle) {
	let isOpen = false // Needed for rendering conditional content

	return () => (
		<div>
			<button
				on={{
					click() {
						isOpen = !isOpen
						handle.update()
					},
				}}
			>
				Toggle
			</button>
			{isOpen && <div>Content</div>}
		</div>
	)
}
```

#### Setup Scope Use Cases

The setup scope is perfect for one-time initialization:

##### Initializing Instances

```tsx
function CacheExample(handle: Handle, setup: { cacheSize: number }) {
	// Initialize cache once
	let cache = new Map()
	let maxSize = setup.cacheSize

	return (props: { key: string; value: any }) => {
		// Use cache in render
		if (cache.has(props.key)) {
			return <div>Cached: {cache.get(props.key)}</div>
		}
		cache.set(props.key, props.value)
		if (cache.size > maxSize) {
			let firstKey = cache.keys().next().value
			cache.delete(firstKey)
		}
		return <div>New: {props.value}</div>
	}
}
```

##### Third-Party SDKs

```tsx
function Analytics(handle: Handle, setup: { apiKey: string }) {
	// Initialize SDK once
	let analytics = new AnalyticsSDK(setup.apiKey)

	// Cleanup on disconnect
	handle.signal.addEventListener('abort', () => {
		analytics.disconnect()
	})

	return (props: { event: string; data?: any }) => {
		// SDK is ready to use
		return <div>Tracking: {props.event}</div>
	}
}
```

##### EventEmitters

```tsx
import { TypedEventTarget } from '@remix-run/interaction'

class DataEvent extends Event {
	constructor(public value: string) {
		super('data')
	}
}

class DataEmitter extends TypedEventTarget<{ data: DataEvent }> {
	emitData(value: string) {
		this.dispatchEvent(new DataEvent(value))
	}
}

function EventListener(handle: Handle, setup: DataEmitter) {
	// Set up listeners once with automatic cleanup
	handle.on(setup, {
		data(event) {
			// Handle data
			handle.update()
		},
	})

	return () => <div>Listening for events...</div>
}
```

##### Window/Document Event Handling

```tsx
function WindowResizeTracker(handle: Handle) {
	let width = window.innerWidth
	let height = window.innerHeight

	// Set up global listeners once
	handle.on(window, {
		resize() {
			width = window.innerWidth
			height = window.innerHeight
			handle.update()
		},
	})

	return () => (
		<div>
			Window size: {width} x {height}
		</div>
	)
}
```

##### Initializing State from Props

```tsx
function Timer(handle: Handle, setup: { initialSeconds: number }) {
	// Initialize from setup prop
	let seconds = setup.initialSeconds
	let interval: number | null = null

	function start() {
		if (interval) return
		interval = setInterval(() => {
			seconds--
			if (seconds <= 0) {
				stop()
			}
			handle.update()
		}, 1000)
	}

	function stop() {
		if (interval) {
			clearInterval(interval)
			interval = null
		}
	}

	// Cleanup on disconnect
	handle.signal.addEventListener('abort', stop)

	return (props: { paused?: boolean }) => {
		if (!props.paused && !interval) {
			start()
		} else if (props.paused && interval) {
			stop()
		}

		return <div>Time remaining: {seconds}s</div>
	}
}
```

#### Focus and Scroll Management

Use `handle.queueTask()` in event handlers for DOM operations that need to
happen after the DOM has changed from the next update.

##### Focus Management

```tsx
function Modal(handle: Handle) {
	let isOpen = false
	let closeButton: HTMLButtonElement
	let openButton: HTMLButtonElement

	return () => (
		<div>
			<button
				connect={(node) => (openButton = node)}
				on={{
					click() {
						isOpen = true
						handle.update()
						// Queue focus operation after modal renders
						handle.queueTask(() => {
							closeButton.focus()
						})
					},
				}}
			>
				Open Modal
			</button>

			{isOpen && (
				<div>
					<button
						connect={(node) => (closeButton = node)}
						on={{
							click() {
								isOpen = false
								handle.update()
								// Queue focus operation after modal closes
								handle.queueTask(() => {
									openButton.focus()
								})
							},
						}}
					>
						Close
					</button>
				</div>
			)}
		</div>
	)
}
```

##### Scroll Management

```tsx
function ScrollableList(handle: Handle) {
	let items: string[] = []
	let newItemInput: HTMLInputElement
	let listContainer: HTMLElement

	return () => (
		<div>
			<input
				connect={(node) => (newItemInput = node)}
				on={{
					keydown(event) {
						if (event.key === 'Enter') {
							let text = event.currentTarget.value
							if (text.trim()) {
								items.push(text)
								event.currentTarget.value = ''
								handle.update()
								// Queue scroll operation after new item renders
								handle.queueTask(() => {
									listContainer.scrollTop = listContainer.scrollHeight
								})
							}
						}
					},
				}}
			/>
			<div
				connect={(node) => (listContainer = node)}
				css={{
					maxHeight: '300px',
					overflowY: 'auto',
				}}
			>
				{items.map((item, i) => (
					<div key={i}>{item}</div>
				))}
			</div>
		</div>
	)
}
```

#### Controlled vs Uncontrolled Inputs

Only control an input's value when something besides the user's interaction with
that input can also control its state.

**Uncontrolled Input** (use when only the user controls the value):

```tsx
function SearchInput(handle: Handle) {
	let results: string[] = []

	return () => (
		<div>
			<input />
			<button>Search</button>
		</div>
	)
}
```

**Controlled Input** (use when programmatic control is needed):

```tsx
function SlugForm(handle: Handle) {
	let slug = ''
	let generatedSlug = ''

	return () => (
		<div>
			<button
				on={{
					click() {
						generatedSlug = 'new-slug'
						slug = generatedSlug
						handle.update()
					},
				}}
			>
				Auto-generate slug
			</button>
			<label>
				Slug
				<input
					value={slug}
					on={{
						input(event) {
							slug = event.currentTarget.value
							handle.update()
						},
					}}
				/>
			</label>
		</div>
	)
}
```

**Use controlled inputs when:**

- The value can be set programmatically (auto-generated fields, reset buttons,
  external state)
- The input can be disabled and its value changed by other interactions
- You need to validate or transform input before it appears
- You need to prevent certain values from being entered

**Use uncontrolled inputs when:**

- Only the user can change the value through direct interaction with that input
- You just need to read the value on events (submit, blur, etc.)

#### Data Loading

##### Using Event Handler Signals

Event handlers receive an `AbortSignal` that's aborted when the handler is
re-entered:

```tsx
function SearchInput(handle: Handle) {
	let results: string[] = []
	let loading = false

	return () => (
		<div>
			<input
				on={{
					async input(event, signal) {
						let query = event.currentTarget.value
						loading = true
						handle.update()

						let response = await fetch(`/search?q=${query}`, { signal })
						let data = await response.json()
						if (signal.aborted) return

						results = data.results
						loading = false
						handle.update()
					},
				}}
			/>
			{loading && <div>Loading...</div>}
			{!loading && results.length > 0 && (
				<ul>
					{results.map((result, i) => (
						<li key={i}>{result}</li>
					))}
				</ul>
			)}
		</div>
	)
}
```

##### Using queueTask for Reactive Data Loading

Use `handle.queueTask()` in the render function for reactive data loading that
responds to prop changes:

```tsx
function DataLoader(handle: Handle) {
	let data: any = null
	let loading = false
	let error: Error | null = null

	return (props: { url: string }) => {
		// Queue data loading task that responds to prop changes
		handle.queueTask(async (signal) => {
			loading = true
			error = null
			handle.update()

			let response = await fetch(props.url, { signal })
			let json = await response.json()
			if (signal.aborted) return
			data = json
			loading = false
			handle.update()
		})

		if (loading) return <div>Loading...</div>
		if (error) return <div>Error: {error.message}</div>
		if (!data) return <div>No data</div>

		return <div>{JSON.stringify(data)}</div>
	}
}
```

##### Using Setup Scope for Initial Data

Load initial data in the setup scope:

```tsx
function UserProfile(handle: Handle, setup: { userId: string }) {
	let user: User | null = null
	let loading = true

	// Load initial data in setup scope using queueTask
	handle.queueTask(async (signal) => {
		let response = await fetch(`/api/users/${setup.userId}`, { signal })
		let data = await response.json()
		if (signal.aborted) return
		user = data
		loading = false
		handle.update()
	})

	return (props: { showEmail?: boolean }) => {
		if (loading) return <div>Loading user...</div>

		return (
			<div>
				<div>{user.name}</div>
				{props.showEmail && <div>{user.email}</div>}
			</div>
		)
	}
}
```

Note that by fetching this data in the setup scope any parent updates that
change `setup.userId` will have no effect.

#### See Also

- [Handle API](./handle.md) - `handle.queueTask()` and `handle.signal`
- [Events](./events.md) - Event handler signals
- [Components](./components.md) - Setup vs render phases

### Animate API (animate.md)

Declarative animations for element lifecycle and layout changes. The `animate`
prop handles three types of animations:

- **Enter**: Animation played when an element mounts
- **Exit**: Animation played when an element is removed (element persists until
  animation completes)
- **Layout**: FLIP animation when an element's position or size changes

#### How It Works

The `animate` prop is an intrinsic property that wraps the Web Animations API
(`element.animate()`). The reconciler handles the complexity:

- **Enter**: Element animates from the specified keyframe(s) to its natural
  styles
- **Exit**: Element animates from its current styles to the specified
  keyframe(s)
- **Layout**: Element smoothly animates from old position/size to new using FLIP
  technique
- **DOM persistence**: When a vnode is removed, the element stays in the DOM
  until the exit animation finishes
- **Interruption**: If an animation is interrupted mid-flight, it reverses from
  its current position rather than jumping to the other animation

#### Basic Usage

##### Default animations

Use `true` to enable default animations for each type:

```tsx
<div animate>Hello</div>
```

This enables:

- **Enter**: Fade in (150ms, ease-out)
- **Exit**: Fade out (150ms, ease-in)
- **Layout**: FLIP position/size animation (200ms, ease-out)

Mix and match as needed:

```tsx
<div animate={{ enter: true, exit: true }} />
<div animate={{ layout: true }} />
<div animate={{ exit: true }} />
```

##### Single keyframe (shorthand)

The `enter` keyframe defines the **starting state** - the element animates
**from** these values **to** its natural styles. The `exit` keyframe defines the
**ending state** - the element animates **from** its current styles **to** these
values:

```tsx
<div
	animate={{
		enter: { opacity: 0, transform: 'scale(0.9)' },
		exit: { opacity: 0, transform: 'scale(0.9)' },
	}}
>
	Modal content
</div>
```

##### Multi-step animations

For complex sequences, provide an array of keyframes:

```tsx
<div
	animate={{
		enter: [
			{ opacity: 0, transform: 'translateY(10px)' },
			{ opacity: 1, transform: 'translateY(0)' },
		],
	}}
>
	Toast notification
</div>
```

##### Conditional animations

Use falsy values to disable animations conditionally. This is useful for
skipping the enter animation on initial render:

```tsx
<div
	animate={{
		enter: isFirstRender ? false : { opacity: 0 },
		exit: { opacity: 0 },
	}}
>
	Content
</div>
```

When `enter` is falsy (`false`, `null`, `undefined`), the element appears
instantly with no animation. The exit animation still plays when the element is
removed.

#### Common Patterns

##### Slide down from top

```tsx
<div
	animate={{
		enter: { opacity: 0, transform: 'translateY(-10px)' },
		exit: { opacity: 0, transform: 'translateY(-10px)' },
	}}
>
	Dropdown menu
</div>
```

##### Slide with blur (icon swap)

```tsx
let iconAnimation = {
	enter: {
		transform: 'translateY(-40px) scale(0.5)',
		filter: 'blur(6px)',
		duration: 100,
		easing: 'ease-out',
	},
	exit: {
		transform: 'translateY(40px) scale(0.5)',
		filter: 'blur(6px)',
		duration: 100,
		easing: 'ease-in',
	},
}

// Use for swapping icons or labels - keys enable smooth cross-fade
{
	state === 'loading' ? (
		<div key="loading" animate={iconAnimation}>
			Loading
		</div>
	) : (
		<div key="success" animate={iconAnimation}>
			Done
		</div>
	)
}
```

##### Enter only (no exit animation)

Element animates in but disappears instantly when removed:

```tsx
<div animate={{ enter: { opacity: 0 }, exit: false }}>One-way animation</div>
```

##### Exit only (no enter animation)

Element appears instantly but animates out:

```tsx
<div animate={{ enter: false, exit: { opacity: 0 } }}>Fade out only</div>
```

##### With delay

Stagger animations or wait before starting:

```tsx
<div animate={{ enter: { opacity: 0, delay: 100 } }}>Delayed entrance</div>
```

#### Interruption Handling

If a user toggles an element before its animation finishes, the current
animation reverses from its current position rather than jumping to the other
animation. This creates smooth, interruptible transitions.

```tsx
// User clicks "Toggle" to show element
// Enter animation starts: opacity 0 -> 1
// User clicks "Toggle" again at opacity 0.4
// Animation reverses: opacity 0.4 -> 0 (doesn't jump to exit animation)
```

If an exit animation is interrupted, it reverses and the node is reclaimed back
into the virtual DOM.

**Important**: For reclamation to work, the element must have a `key` prop:

```tsx
// Reclamation works - element can be interrupted and reused
{
	show && (
		<div key="panel" animate={{ exit: { opacity: 0 } }}>
			...
		</div>
	)
}

// No reclamation - element is recreated each time
{
	show && <div animate={{ exit: { opacity: 0 } }} />
}
```

Without a key, the reconciler can't determine if a new element should reclaim an
exiting one, so interrupting an exit animation will still remove the old element
and create a new one.

#### With Spring Easing

Spread a spring value to get physics-based `duration` and `easing`:

```tsx
import { spring } from '@remix-run/component'

let el = (
	<div animate={{ enter: { opacity: 0, ...spring('bouncy') } }}>
		Bouncy modal
	</div>
)
```

See [Spring API](./spring.md) for available presets and custom spring options.

#### Complete Example

A toggle component with animate:

```tsx
import { createRoot, type Handle } from '@remix-run/component'

function ToggleContent(handle: Handle) {
	let show = false

	return () => (
		<>
			<button
				on={{
					click() {
						show = !show
						handle.update()
					},
				}}
			>
				Toggle
			</button>

			{show && (
				<div
					key="content"
					animate={{ enter: { opacity: 0 }, exit: { opacity: 0 } }}
				>
					Content that animates in and out
				</div>
			)}
		</>
	)
}
```

#### Layout Animations

The `layout` property enables automatic FLIP (First, Last, Invert, Play)
animations when an element's position or size changes due to layout shifts.
Instead of the element jumping to its new position, it smoothly animates there.

##### Basic Usage

Enable layout animations with `layout: true`:

```tsx
<div animate={{ layout: true }}>Animates position/size changes</div>
```

Or customize duration and easing, including springs:

```tsx
import { spring } from '@remix-run/component'

let custom = (
	<div animate={{ layout: { duration: 300, easing: 'ease-in-out' } }}>Ease</div>
)

let springEasing = (
	<div animate={{ layout: { ...spring('bouncy') } }}>Bouncy</div>
)
```

##### How It Works

Layout animations use the FLIP technique:

1. **First**: Before any DOM changes, the element's current position is captured
2. **Last**: After DOM changes, the new position is measured
3. **Invert**: A CSS transform is applied to make the element appear at its old
   position
4. **Play**: The transform animates to identity, moving the element to its new
   position

This approach is performant because it only animates `transform` (and optionally
`scale`), which are GPU-accelerated and don't trigger layout recalculations.

##### What Gets Animated

Layout animations handle:

- **Position changes**: Moving left/right/up/down via `translate3d()`
- **Size changes**: Width/height changes via `scale()`

##### Example: Toggle Switch

A classic use case is animating a toggle knob when its `justify-content`
changes:

```tsx
function FlipToggle(handle: Handle) {
	let isOn = false

	return () => (
		<button
			on={{
				click() {
					isOn = !isOn
					handle.update()
				},
			}}
		>
			<div
				animate={{ layout: true }}
				css={{
					display: 'flex',
					justifyContent: isOn ? 'flex-end' : 'flex-start',
				}}
			>
				<div css={{ width: 24, height: 24 }} />
			</div>
		</button>
	)
}
```

When clicked, the knob smoothly slides from one side to the other instead of
jumping.

##### Example: List Reordering

Layout animations shine when reordering list items:

```tsx
function ReorderableList(handle: Handle) {
	let items = [
		{ id: 'a', name: 'Apple' },
		{ id: 'b', name: 'Banana' },
		{ id: 'c', name: 'Cherry' },
	]

	function shuffle() {
		items = [...items].sort(() => Math.random() - 0.5)
		handle.update()
	}

	return () => (
		<>
			<button on={{ click: shuffle }}>Shuffle</button>
			<ul>
				{items.map((item) => (
					<li key={item.id} animate={{ layout: true }}>
						{item.name}
					</li>
				))}
			</ul>
		</>
	)
}
```

Each item animates to its new position when the list order changes.

##### Combining with Enter/Exit

Layout animations work alongside enter/exit animations:

```tsx
<div animate={{ layout: true, enter: { opacity: 0 }, exit: { opacity: 0 } }}>
	Fades in/out and animates position changes
</div>
```

##### Interruption

Layout animations are interruptible. If the layout changes again while an
animation is in progress:

1. The current animation is cancelled
2. The element's current visual position is captured
3. A new animation starts from that position to the new target

This ensures smooth transitions even during rapid layout changes.

##### Configuration Options

```tsx
interface LayoutAnimationConfig {
	duration?: number // Animation duration in ms (default: 200)
	easing?: string // CSS easing function (default: 'ease-out')
}
```

All options are optional - use `layout: true` for defaults, or customize:

```tsx
// Just layout with defaults
animate={{ layout: true }}

// Custom duration only
animate={{ layout: { duration: 300 } }}

// Custom easing only
animate={{ layout: { easing: 'ease-in-out' } }}

// Spring physics
animate={{ layout: { ...spring('bouncy') } }}
```

#### Tips

- **Keep durations short**: 100-300ms feels snappy. Longer durations can feel
  sluggish.
- **Use `ease-out` for enter**: Elements should decelerate as they arrive at
  their final position.
- **Use `ease-in` for exit**: Elements should accelerate as they leave.
- **Use springs for layout**: Physics-based easing feels natural for
  position/size changes.
- **Always use `key` for animated elements**: Keys are required for reclamation
  (interrupting exit to re-enter) and for layout animations to track element
  identity. Even conditionally rendered elements need keys:
  `{show && <Element key="..." />}`
- **Skip animation on first render**: For elements like labels that shouldn't
  animate on initial mount, use a falsy value for `enter`:

```tsx
function Label(handle: Handle) {
	let isFirstRender = true
	handle.queueTask(() => {
		isFirstRender = false
	})

	return (props: { text: string }) => (
		<span animate={{ enter: isFirstRender ? false : { opacity: 0 } }}>
			{props.text}
		</span>
	)
}
```

### Spring API (spring.md)

A physics-based spring animation function that returns an iterator with CSS
easing.

#### Basic Usage

```tsx
import { spring } from './spring.ts'

// Using a preset
spring('bouncy') // bouncy with overshoot
spring('snappy') // quick, no overshoot (default)
spring('smooth') // gentle, overdamped

// Custom spring
spring({ duration: 400, bounce: 0.3 })
```

#### Return Value

`spring()` returns a `SpringIterator`:

```ts
interface SpringIterator extends IterableIterator<number> {
	duration: number // CSS duration in ms (e.g., 550)
	easing: string // CSS linear() function
	toString(): string // "550ms linear(...)"
}
```

The iterator can be:

- **Iterated** to get position values (0->1) for JS animations
- **Spread** into objects (for animate/WAAPI)
- **Stringified** via template literals or `String()` (for CSS transitions)

#### CSS Transitions

##### Template literal

```tsx
css={{
 transition: `width ${spring('bouncy')}`
}}
// -> "width 550ms linear(...)"
```

##### Multiple properties (same spring)

```tsx
css={{
 transition: `transform ${spring('bouncy')}, opacity ${spring('bouncy')}`
}}
```

##### Using the helper

```tsx
css={{
 transition: spring.transition('width', 'bouncy')
}}
// -> "width 550ms linear(...)"

css={{
 transition: spring.transition(['left', 'top'], 'snappy')
}}
// -> "left 385ms linear(...), top 385ms linear(...)"
```

#### Animate Prop

Spread the spring value to get both `duration` and `easing`:

```tsx
animate={{
 enter: {
 opacity: 0,
 transform: 'scale(0.9)',
 ...spring('bouncy')
 },
 exit: {
 opacity: 0,
 ...spring('snappy')
 }
}}
```

#### Presets

| Preset   | Bounce | Duration | Character                   |
| -------- | ------ | -------- | --------------------------- |
| `smooth` | -0.3   | 400ms    | Overdamped, no overshoot    |
| `snappy` | 0      | 200ms    | Critically damped, quick    |
| `bouncy` | 0.3    | 300ms    | Underdamped, visible bounce |

##### Override preset duration

```tsx
spring('bouncy', { duration: 300 }) // faster bouncy
spring('smooth', { duration: 800 }) // slower smooth
```

#### Custom Springs

##### Parameters

```tsx
spring({
	duration: 500, // perceived duration in milliseconds
	bounce: 0.3, // -1 to 1 (negative = overdamped, 0 = critical, positive = bouncy)
	velocity: 0, // initial velocity in units per second
})
```

##### Bounce values

- `bounce < 0`: Overdamped (slower settling, no overshoot)
- `bounce = 0`: Critically damped (fastest settling without overshoot)
- `bounce > 0`: Underdamped (bouncy, overshoots target)

```tsx
spring({ bounce: -0.5 }) // very smooth, slow
spring({ bounce: 0 }) // snappy, no bounce
spring({ bounce: 0.3 }) // slight bounce
spring({ bounce: 0.7 }) // very bouncy
```

#### Velocity

Use `velocity` to continue momentum from a gesture:

```tsx
// Positive = moving toward target (more overshoot)
// Negative = moving away from target (takes longer)

spring('bouncy', { velocity: 2 }) // fast start
spring('bouncy', { velocity: -1 }) // initially going backward
```

##### Calculating velocity from drag

```tsx
// velocity is in px/s, distance is in px
let normalizedVelocity = velocityTowardTarget / distanceToTarget

spring('bouncy', { velocity: normalizedVelocity })
```

#### Iterating for JS Animations

The spring iterator yields position values from 0 to 1, one per frame (~60fps):

```tsx
let s = spring('bouncy')

for (let t of s) {
	console.log(t) // 0, 0.015, 0.058, 0.121, ... 1
}
```

##### Interpolating between values

Use the 0->1 progress to interpolate any value:

```tsx
let from = 100
let to = 500

for (let t of spring('bouncy')) {
	let value = from + (to - from) * t // 100 -> 500
	updateSomething(value)
	await nextFrame()
}
```

##### Canvas animation

```tsx
let s = spring('bouncy')

function draw() {
	let { value, done } = s.next()

	ctx.clearRect(0, 0, canvas.width, canvas.height)
	ctx.beginPath()
	ctx.arc(value * 400, 100, 20, 0, Math.PI * 2) // x: 0 -> 400
	ctx.fill()

	if (!done) requestAnimationFrame(draw)
}

draw()
```

##### Animating multiple properties

```tsx
let fromX = 0,
	toX = 200
let fromY = 0,
	toY = 100
let fromScale = 0.5,
	toScale = 1

for (let t of spring('bouncy')) {
	let x = fromX + (toX - fromX) * t
	let y = fromY + (toY - fromY) * t
	let scale = fromScale + (toScale - fromScale) * t

	render({ x, y, scale })
	await nextFrame()
}
```

##### Color interpolation

```tsx
let fromRGB = [255, 0, 0] // red
let toRGB = [0, 0, 255] // blue

for (let t of spring('smooth')) {
	let r = Math.round(fromRGB[0] + (toRGB[0] - fromRGB[0]) * t)
	let g = Math.round(fromRGB[1] + (toRGB[1] - fromRGB[1]) * t)
	let b = Math.round(fromRGB[2] + (toRGB[2] - fromRGB[2]) * t)

	element.style.backgroundColor = `rgb(${r}, ${g}, ${b})`
	await nextFrame()
}
```

#### Accessing Raw Values

```tsx
let { duration, easing } = spring('bouncy')

// duration: 550 (ms)
// easing: "linear(0.0000, 0.0156, ...)"
```

#### Accessing Preset Defaults

```tsx
spring.presets
// {
// smooth: { duration: 400, bounce: -0.3 },
// snappy: { duration: 200, bounce: 0 },
// bouncy: { duration: 300, bounce: 0.3 }
// }
```

#### Web Animations API

```tsx
element.animate(keyframes, {
	...spring('bouncy'),
})
```

#### Complete Example

```tsx
function AnimatedCard(handle: Handle) {
	let isExpanded = false

	return () => (
		<div
			on={{
				click() {
					isExpanded = !isExpanded
					handle.update()
				},
			}}
			css={{
				transition: spring.transition('height', 'smooth'),
				height: isExpanded ? 200 : 80,
			}}
		>
			Click me
		</div>
	)
}
```

### Tween API (tween.md)

A generator-based tween function for animating values over time with cubic
bezier easing.

#### Basic Usage

```tsx
import { tween, easings } from '@remix-run/component'

let animation = tween({
	from: 0,
	to: 100,
	duration: 1000,
	curve: easings.easeInOut,
})

// Initialize generator
animation.next()

function animate(timestamp: number) {
	let { value, done } = animation.next(timestamp)
	element.style.transform = `translateX(${value}px)`
	if (!done) requestAnimationFrame(animate)
}

requestAnimationFrame(animate)
```

#### How It Works

The `tween` function returns a generator that:

1. Yields the current interpolated value on each iteration
2. Receives the current timestamp via `next(timestamp)`
3. Returns `done: true` when the duration has elapsed

The generator uses cubic bezier curves to map linear time progress to eased
value progress, matching CSS `cubic-bezier()` timing functions.

#### Easing Presets

Built-in easing curves matching CSS timing functions:

```tsx
import { easings } from '@remix-run/component'

easings.linear // { x1: 0, y1: 0, x2: 1, y2: 1 }
easings.ease // { x1: 0.25, y1: 0.1, x2: 0.25, y2: 1 }
easings.easeIn // { x1: 0.42, y1: 0, x2: 1, y2: 1 }
easings.easeOut // { x1: 0, y1: 0, x2: 0.58, y2: 1 }
easings.easeInOut // { x1: 0.42, y1: 0, x2: 0.58, y2: 1 }
```

#### Custom Curves

Define custom bezier curves with control points:

```tsx
let customCurve = {
	x1: 0.68,
	y1: -0.55,
	x2: 0.265,
	y2: 1.55,
}

let animation = tween({
	from: 0,
	to: 100,
	duration: 500,
	curve: customCurve,
})
```

The control points match CSS `cubic-bezier(x1, y1, x2, y2)` syntax.

#### In Components

Use tween with `handle.signal` for automatic cleanup:

```tsx
function AnimatedValue(handle: Handle) {
	let value = 0

	function animateTo(target: number) {
		let animation = tween({
			from: value,
			to: target,
			duration: 300,
			curve: easings.easeOut,
		})

		animation.next() // Initialize

		function tick(timestamp: number) {
			if (handle.signal.aborted) return

			let result = animation.next(timestamp)
			value = result.value
			handle.update()

			if (!result.done) {
				requestAnimationFrame(tick)
			}
		}

		requestAnimationFrame(tick)
	}

	return () => (
		<div>
			<div>Moving {value}</div>
			<button
				on={{
					click() {
						animateTo(100)
					},
				}}
			>
				Animate
			</button>
		</div>
	)
}
```

#### Multiple Properties

Animate multiple values with separate tweens:

```tsx
let xAnimation = tween({
	from: 0,
	to: 100,
	duration: 500,
	curve: easings.easeOut,
})
let yAnimation = tween({
	from: 0,
	to: 50,
	duration: 500,
	curve: easings.easeOut,
})
let scaleAnimation = tween({
	from: 1,
	to: 1.5,
	duration: 500,
	curve: easings.easeOut,
})

xAnimation.next()
yAnimation.next()
scaleAnimation.next()

function animate(timestamp: number) {
	let x = xAnimation.next(timestamp)
	let y = yAnimation.next(timestamp)
	let scale = scaleAnimation.next(timestamp)

	element.style.transform = `translate(${x.value}px, ${y.value}px) scale(${scale.value})`

	if (!x.done || !y.done || !scale.done) {
		requestAnimationFrame(animate)
	}
}

requestAnimationFrame(animate)
```

#### API Reference

##### `tween(options)`

Creates a generator that interpolates between values over time.

```ts
interface TweenOptions {
	from: number // Starting value
	to: number // Ending value
	duration: number // Duration in milliseconds
	curve: BezierCurve // Easing curve
}

interface BezierCurve {
	x1: number // First control point X (0-1)
	y1: number // First control point Y
	x2: number // Second control point X (0-1)
	y2: number // Second control point Y
}
```

**Returns:** `Generator<number, number, number>` - Yields current value, returns
final value when done.

##### `easings`

Object containing preset bezier curves:

| Preset      | Description               |
| ----------- | ------------------------- |
| `linear`    | No easing, constant speed |
| `ease`      | Default CSS ease          |
| `easeIn`    | Slow start, fast end      |
| `easeOut`   | Fast start, slow end      |
| `easeInOut` | Slow start and end        |

#### When to Use

Use `tween` for:

- Imperative animations driven by `requestAnimationFrame`
- Canvas/WebGL animations
- Animating non-CSS properties
- Complex sequenced animations

For most UI animations, prefer the declarative [`animate` prop](./animate.md) or
CSS transitions with [`spring`](./spring.md).

#### See Also

- [Animate API](./animate.md) - Declarative enter/exit/layout animations
- [Spring API](./spring.md) - Physics-based easing for CSS

### Testing (testing.md)

When writing tests, use `root.flush()` to synchronously execute all pending
updates and tasks. This ensures the DOM and component state are fully
synchronized before making assertions.

#### Basic Testing Pattern

The main use case is flushing after events that call `handle.update()`. Since
updates are asynchronous, you need to flush to ensure the DOM reflects the
changes:

```tsx
function Counter(handle: Handle) {
	let count = 0

	return () => (
		<button
			on={{
				click() {
					count++
					handle.update()
				},
			}}
		>
			Count: {count}
		</button>
	)
}

// In your test
let container = document.createElement('div')
let root = createRoot(container)

root.render(<Counter />)
root.flush() // Ensure initial render completes

let button = container.querySelector('button')
button.click() // Triggers handle.update()
root.flush() // Flush to apply the update

expect(container.textContent).toBe('Count: 1')
```

#### Why Flush After Initial Render?

You should also flush after the initial `root.render()` to ensure event
listeners are attached and the DOM is ready for interaction:

```tsx
let root = createRoot(container)
root.render(<Counter />)
root.flush() // Event listeners now attached

// Safe to interact
container.querySelector('button').click()
```

#### Testing Async Operations

For components with async operations in `queueTask`, flush after each step:

```tsx
function AsyncLoader(handle: Handle) {
	let data: string | null = null

	handle.queueTask(async (signal) => {
		let response = await fetch('/api/data', { signal })
		let json = await response.json()
		if (signal.aborted) return
		data = json.value
		handle.update()
	})

	return () => <div>{data ?? 'Loading...'}</div>
}

// In your test (with mocked fetch)
let root = createRoot(container)
root.render(<AsyncLoader />)
root.flush()

expect(container.textContent).toBe('Loading...')

// After fetch resolves
await waitForFetch()
root.flush()

expect(container.textContent).toBe('Expected data')
```

#### Testing Component Removal

Use `root.remove()` to clean up and verify cleanup behavior:

```tsx
let root = createRoot(container)
root.render(<App />)
root.flush()

// Verify setup behavior
expect(container.querySelector('.content')).toBeTruthy()

// Remove and verify cleanup
root.remove()
expect(container.innerHTML).toBe('')
```

#### See Also

- [Getting Started](./getting-started.md) - Root methods reference
- [Handle API](./handle.md) - `handle.queueTask()` behavior

## Navigation

- [Remix package index](./index.md)
