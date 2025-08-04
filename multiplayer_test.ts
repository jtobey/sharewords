import { expect, describe, it } from 'bun:test'
import { App } from './app.js'
import { TestBrowser } from './test_browser.js'
import { fromTurnNumber } from './turn.js'

describe('multi-player', () => {
  it('should allow two players to take turns', async () => {
    // Player 1's environment
    const browser1 = new TestBrowser()
    const app1 = new App(browser1)
    await app1.init()

    // Player 2's environment
    const browser2 = new TestBrowser()
    const app2 = new App(browser2)
    // Initially, player 2 has no hash, so they will create their own game.
    await app2.init()

    // Player 1 starts a game, which creates a hash.
    expect(browser1.getHash()).not.toBe('')
    expect(fromTurnNumber(app1.gameState.nextTurnNumber)).toBe(1)

    // Player 1 passes their turn
    await app1.gameState.passOrExchange()

    expect(fromTurnNumber(app1.gameState.nextTurnNumber)).toBe(2);
    const player1Hash = browser1.getHash()
    expect(player1Hash).not.toBe('')

    // Player 2 gets the hash from player 1 (e.g. via a chat message)
    browser2.setHash(player1Hash.substring(1))
    // This will trigger a hashchange event, which will cause app2 to update.
    // We need to wait for the async operations to complete.
    await new Promise(resolve => setTimeout(resolve, 0));

    // Now, player 2's game state should be synced with player 1's
    expect(JSON.stringify(app2.gameState.shared)).toEqual(JSON.stringify(app1.gameState.shared))

    // Player 2 makes a move
    await app2.gameState.passOrExchange()

    expect(fromTurnNumber(app2.gameState.nextTurnNumber)).toBe(3);
    const player2Hash = browser2.getHash()
    expect(player2Hash).not.toBe(player1Hash)

    // Player 1 gets the hash from player 2
    browser1.setHash(player2Hash.substring(1))
    await new Promise(resolve => setTimeout(resolve, 0));

    // Now, player 1's game state should be synced with player 2's
    expect(JSON.stringify(app1.gameState.shared)).toEqual(JSON.stringify(app2.gameState.shared))
  })
})
