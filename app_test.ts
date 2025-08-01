import { expect, describe, it, beforeAll } from 'bun:test'
import { Window } from 'happy-dom'

describe('app', () => {
  beforeAll(() => {
    const window = new Window()
    const document = window.document
    // TODO - Try to share this with style.css.
    document.head.innerHTML = `<style>
      .tile { width: 40px; height: 40px; }
    </style>`
    // TODO - Try to share this with index.html.
    document.body.innerHTML = `
      <div id="game-container">
        <div id="board-container"></div>
        <div id="controls-container">
          <div id="rack-container"></div>
          <div id="exchange-container"></div>
          <div id="buttons-container">
            <button id="play-word"></button>
            <button id="pass-exchange"></button>
          </div>
        </div>
      </div>
    `
    global.window = window as any
    global.document = document as any
    global.localStorage = window.localStorage as any
    global.URLSearchParams = window.URLSearchParams as any
  })

  it('should render the board', async () => {
    await import('./app.js')
    const boardContainer = document.getElementById('board-container')!
    expect(boardContainer.children.length).toBe(225)
  })

  it('should render rack tiles with non-zero dimensions', async () => {
    await import('./app.js')
    const rackContainer = document.getElementById('rack-container')!
    const tile = rackContainer.querySelector('.tile')
    expect(tile).not.toBeNull()
    const style = window.getComputedStyle(tile!)
    expect(parseInt(style.width, 10)).toBeGreaterThan(0)
    expect(parseInt(style.height, 10)).toBeGreaterThan(0)
  })
})
