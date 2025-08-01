import { expect, describe, it, beforeAll, spy } from 'bun:test'
import { Window } from 'happy-dom'
import { GameState } from './game_state'

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

  it('should call playWord when the button is clicked', async () => {
    let playWordCalled = false
    GameState.prototype.playWord = async () => {
      playWordCalled = true
      return Promise.resolve()
    }
    await import('./app.js')
    const playWordButton = document.getElementById('play-word')!
    playWordButton.click()
    expect(playWordCalled).toBe(true)
  })

  it('should call passOrExchange when the button is clicked', async () => {
    let passOrExchangeCalled = false
    GameState.prototype.passOrExchange = async () => {
      passOrExchangeCalled = true
      return Promise.resolve()
    }
    await import('./app.js')
    const passOrExchangeButton = document.getElementById('pass-exchange')!
    passOrExchangeButton.click()
    expect(passOrExchangeCalled).toBe(true)
  })

  describe('keyboard navigation', () => {
    let app: any
    beforeAll(async () => {
      app = await import('./app.js')
    })

    it('should move down from rack to exchange', () => {
      const rackTile = document.querySelector('[data-row="rack"][data-col="0"]') as HTMLElement
      app.select('rack', 0)
      app.setDropTarget('rack', 0)
      rackTile.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }))
      expect(app.getDropTarget()?.row).toBe('exchange')
    })

    it('should move up from exchange to rack', () => {
      const exchangeTile = document.querySelector('[data-row="exchange"][data-col="0"]') as HTMLElement
      app.select('exchange', 0)
      app.setDropTarget('exchange', 0)
      exchangeTile.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }))
      expect(app.getDropTarget()?.row).toBe('rack')
    })

    it('should not move left from the leftmost exchange spot', () => {
      const exchangeTile = document.querySelector('[data-row="exchange"][data-col="0"]') as HTMLElement
      app.select('exchange', 0)
      app.setDropTarget('exchange', 0)
      exchangeTile.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }))
      expect(app.getDropTarget()?.col).toBe(0)
    })

    it('should move right in the exchange area', () => {
      const exchangeTile = document.querySelector('[data-row="exchange"][data-col="0"]') as HTMLElement
      app.select('exchange', 0)
      app.setDropTarget('exchange', 0)
      exchangeTile.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }))
      expect(app.getDropTarget()?.col).toBe(1)
    })
  })
})
