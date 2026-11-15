import { mount } from 'svelte'
// Exo 2 (SIL Open Font License), bundled with the game: see docs/sources.md.
import '@fontsource-variable/exo-2'
import './app.css'
import App from './App.svelte'

const app = mount(App, {
  target: document.getElementById('app')!,
})

export default app
