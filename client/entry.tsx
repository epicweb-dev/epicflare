import { createRoot } from 'remix/component'
import { App } from './app.tsx'

const rootElement = document.getElementById('root') ?? document.body
createRoot(rootElement).render(<App />)
