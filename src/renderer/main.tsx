import ReactDOM from 'react-dom/client'
import { App } from './App'
import './assets/globals.css'
import '@xterm/xterm/css/xterm.css'

document.documentElement.classList.add('dark')

ReactDOM.createRoot(document.getElementById('root')!).render(<App />)
