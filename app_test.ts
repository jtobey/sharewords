import { expect, describe, it, beforeAll } from 'bun:test'
import { Window } from 'happy-dom'

describe('app', () => {
  beforeAll(() => {
    const window = new Window()
    const document = window.document
    document.body.innerHTML = `
      <div id="board-container"></div>
      <div id="rack-container"></div>
      <button id="show-stats"></button>
      <button id="play-word"></button>
      <button id="pass-exchange"></button>
    `
    global.window = window
    global.document = document
    global.localStorage = window.localStorage
    global.URLSearchParams = window.URLSearchParams
  })

  it('should render the board', async () => {
    await import('./app.js')
    const boardContainer = document.getElementById('board-container')!
    expect(boardContainer.children.length).toBe(225)
  })
})
