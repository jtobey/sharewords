import { expect, describe, it, beforeAll, beforeEach } from 'bun:test'
import { Window } from 'happy-dom'
import { GameState } from './game_state'
import { init, controller, view } from './app.js'

describe('app', () => {
  beforeEach(async () => {
    const window = new Window()
    const document = window.document
    // TODO - Try to share this with style.css.
    document.head.innerHTML = `<style>
      .tile { width: 40px; height: 40px; }
    </style>`
    // TODO - Try to share this with index.html.
    document.body.innerHTML = `
      <div id="game-container">
        <div id="center-panel">
          <div id="score-panel"></div>
          <div id="board-container"></div>
        </div>
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
    await init()
  })

  it('should render the board', () => {
    const boardContainer = document.getElementById('board-container')!
    expect(boardContainer.children.length).toBe(225)
  })

  it('should render rack tiles with non-zero dimensions', () => {
    const rackContainer = document.getElementById('rack-container')!
    const tile = rackContainer.querySelector('.tile')
    expect(tile).not.toBeNull()
    const style = window.getComputedStyle(tile!)
    expect(parseInt(style.width, 10)).toBeGreaterThan(0)
    expect(parseInt(style.height, 10)).toBeGreaterThan(0)
  })

  it('should call playWord when the button is clicked', () => {
    let playWordCalled = false
    GameState.prototype.playWord = async () => {
      playWordCalled = true
      return Promise.resolve()
    }
    const playWordButton = document.getElementById('play-word')!
    playWordButton.click()
    expect(playWordCalled).toBe(true)
  })

  it('should call passOrExchange when the button is clicked', () => {
    let passOrExchangeCalled = false
    GameState.prototype.passOrExchange = async () => {
      passOrExchangeCalled = true
      return Promise.resolve()
    }
    const passOrExchangeButton = document.getElementById('pass-exchange')!
    passOrExchangeButton.click()
    expect(passOrExchangeCalled).toBe(true)
  })

  describe('keyboard navigation', () => {
    it('should move down from rack to exchange', () => {
      controller.select('rack', 0)
      controller.moveDropTarget('ArrowDown')
      const dropTarget = view.getDropTarget()
      expect(dropTarget).not.toBeNull()
      expect(dropTarget!.row).toBe('exchange')
    })

    it('should move up from exchange to rack', () => {
      controller.select('exchange', 0)
      controller.moveDropTarget('ArrowUp')
      const dropTarget = view.getDropTarget()
      expect(dropTarget).not.toBeNull()
      expect(dropTarget!.row).toBe('rack')
    })

    it('should not move left from the leftmost exchange spot', () => {
      controller.select('exchange', 0)
      controller.moveDropTarget('ArrowLeft')
      const dropTarget = view.getDropTarget()
      expect(dropTarget).not.toBeNull()
      expect(dropTarget!.col).toBe(0)
    })

    it('should move right in the exchange area', () => {
      controller.select('exchange', 0)
      controller.moveDropTarget('ArrowRight')
      const dropTarget = view.getDropTarget()
      expect(dropTarget).not.toBeNull()
      expect(dropTarget!.col).toBe(1)
    })
  })
})
