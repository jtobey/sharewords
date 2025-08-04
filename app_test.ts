import { expect, describe, it, beforeEach } from 'bun:test'
import { GameState } from './game_state'
import { App } from './app.js'
import { TestBrowser } from './test_browser.js'

describe('app', () => {
  let app: App
  let browser: TestBrowser

  beforeEach(async () => {
    browser = new TestBrowser()
    app = new App(browser)
    await app.init()
  })

  it('should render the board', () => {
    const boardContainer = browser.getDocument().getElementById('board-container')!
    expect(boardContainer.children.length).toBe(225)
  })

  it('should render rack tiles with non-zero dimensions', () => {
    const rackContainer = browser.getDocument().getElementById('rack-container')!
    const tile = rackContainer.querySelector('.tile')
    expect(tile).not.toBeNull()
    const style = browser.getDocument().defaultView!.getComputedStyle(tile!)
    expect(parseInt(style.width, 10)).toBeGreaterThan(0)
    expect(parseInt(style.height, 10)).toBeGreaterThan(0)
  })

  it('should call playWord when the button is clicked', async () => {
    let playWordCalled = false
    GameState.prototype.playWord = async () => {
      playWordCalled = true
      return Promise.resolve()
    }
    app.view.showConfirmationDialog = async () => Promise.resolve({ confirmed: true, copyUrl: false });

    const playWordButton = browser.getDocument().getElementById('play-word')!
    playWordButton.click()
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(playWordCalled).toBe(true)
  })

  it('should call passOrExchange when the button is clicked', async () => {
    let passOrExchangeCalled = false
    GameState.prototype.passOrExchange = async () => {
      passOrExchangeCalled = true
      return Promise.resolve()
    }
    app.view.showConfirmationDialog = async () => Promise.resolve({ confirmed: true, copyUrl: false });

    const passOrExchangeButton = browser.getDocument().getElementById('pass-exchange')!
    passOrExchangeButton.click()
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(passOrExchangeCalled).toBe(true)
  })

  describe('keyboard navigation', () => {
    it('should move down from rack to exchange', () => {
      app.controller.keyHandler.select('rack', 0)
      app.controller.keyHandler.moveDropTarget('ArrowDown')
      const dropTarget = app.view.getDropTarget()
      expect(dropTarget).not.toBeNull()
      expect(dropTarget!.row).toBe('exchange')
    })

    it('should move up from exchange to rack', () => {
      app.controller.keyHandler.select('exchange', 0)
      app.controller.keyHandler.moveDropTarget('ArrowUp')
      const dropTarget = app.view.getDropTarget()
      expect(dropTarget).not.toBeNull()
      expect(dropTarget!.row).toBe('rack')
    })

    it('should not move left from the leftmost exchange spot', () => {
      app.controller.keyHandler.select('exchange', 0)
      app.controller.keyHandler.moveDropTarget('ArrowLeft')
      const dropTarget = app.view.getDropTarget()
      expect(dropTarget).not.toBeNull()
      expect(dropTarget!.col).toBe(0)
    })

    it('should move right in the exchange area', () => {
      app.controller.keyHandler.select('exchange', 0)
      app.controller.keyHandler.moveDropTarget('ArrowRight')
      const dropTarget = app.view.getDropTarget()
      expect(dropTarget).not.toBeNull()
      expect(dropTarget!.col).toBe(1)
    })

    it('should move up from rack to board', () => {
      app.controller.keyHandler.select('rack', 0)
      app.controller.keyHandler.moveDropTarget('ArrowUp')
      const dropTarget = app.view.getDropTarget()
      expect(dropTarget).not.toBeNull()
      expect(dropTarget!.row).toBe(14)
      // Jumps from rack 0 to board col 7 + (0 - 3) = 4.
      expect(dropTarget!.col).toBe(4)
    })

    it('should move down from board to rack', () => {
      app.controller.keyHandler.select(14, 0)
      app.controller.keyHandler.moveDropTarget('ArrowDown')
      const dropTarget = app.view.getDropTarget()
      expect(dropTarget).not.toBeNull()
      expect(dropTarget!.row).toBe('rack')
      // Jumps from board col 0 to rack 7 + (0 - 7) = 0.
      expect(dropTarget!.col).toBe(0)
    })

    it('should move right from board to rack', () => {
      app.controller.keyHandler.select(0, 14)
      app.controller.keyHandler.moveDropTarget('ArrowRight')
      const dropTarget = app.view.getDropTarget()
      expect(dropTarget).not.toBeNull()
      expect(dropTarget!.row).toBe('rack')
      expect(dropTarget!.col).toBe(0)
    })

    it('should move left from rack to board', () => {
      app.controller.keyHandler.select('rack', 0)
      app.controller.keyHandler.moveDropTarget('ArrowLeft')
      const dropTarget = app.view.getDropTarget()
      expect(dropTarget).not.toBeNull()
      expect(dropTarget!.row).toBe(7)
      expect(dropTarget!.col).toBe(14)
    })
  })
})
