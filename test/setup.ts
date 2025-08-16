import { Window } from 'happy-dom'

const window = new Window()
global.HTMLElement = window.HTMLElement as any
