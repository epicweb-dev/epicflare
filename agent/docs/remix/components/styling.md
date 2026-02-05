# Styling

The `css` prop provides inline styling with support for pseudo-selectors,
pseudo-elements, attribute selectors, descendant selectors, and media queries.
It follows modern CSS nesting selector rules.

## Basic CSS Prop

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

## CSS Prop vs Style Prop

The `css` prop produces static styles that are inserted into the document as CSS
rules, while the `style` prop applies styles directly to the element. For
**dynamic styles** that change frequently, use the `style` prop for better
performance:

```tsx
// ❌ Avoid: Using css prop for dynamic styles
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

// ✅ Prefer: Using style prop for dynamic styles
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

## Pseudo-Selectors

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

## Pseudo-Elements

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

## Attribute Selectors

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

## Descendant Selectors

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

## When to Use Nested Selectors

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
// ❌ Avoid: Managing hover state in JavaScript
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

// ✅ Prefer: CSS nested selectors handle state declaratively
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

## Media Queries

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

## Complete Example

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

## See Also

- [Spring API](./spring.md) - Physics-based animation easing
- [Animate API](./animate.md) - Declarative enter/exit/layout animations
