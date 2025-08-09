import { expect, describe, it } from 'bun:test'
import { App } from './app.js'
import { TestBrowser } from './test_browser.js'
import { fromTurnNumber } from './game/turn.js'

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

  it('should handle collisions in pending placements', async () => {
    // Player 1's environment
    const browser1 = new TestBrowser()
    const app1 = new App(browser1)
    await app1.init()

    // Player 2's environment
    const browser2 = new TestBrowser()
    const app2 = new App(browser2)
    // Initially, player 2 has no hash, so they will create their own game.
    await app2.init()

    // Player 1 places two tiles near the center
    const p1_tile1_placement = app1.gameState.tilesHeld.find(p => p.row === 'rack')!
    app1.gameState.moveTile(p1_tile1_placement.row, p1_tile1_placement.col, 7, 7)
    const p1_tile2_placement = app1.gameState.tilesHeld.find(p => p.row === 'rack')!
    app1.gameState.moveTile(p1_tile2_placement.row, p1_tile2_placement.col, 7, 8)

    // Player 1 passes their turn. The pending placements are not part of the turn.
    await app1.gameState.passOrExchange()
    const player1Hash = browser1.getHash()

    // Player 2 gets the hash from player 1
    browser2.setHash(player1Hash.substring(1))
    await new Promise(resolve => setTimeout(resolve, 0));

    // Player 2's board is empty. Player 2 makes a valid move on the center square.
    const p2_tile1_placement = app2.gameState.tilesHeld.find(p => p.row === 'rack')!
    app2.gameState.moveTile(p2_tile1_placement.row, p2_tile1_placement.col, 7, 7)
    const p2_tile2_placement = app2.gameState.tilesHeld.find(p => p.row === 'rack')!
    app2.gameState.moveTile(p2_tile2_placement.row, p2_tile2_placement.col, 8, 7)
    await app2.gameState.playWord()
    const player2Hash = browser2.getHash()

    // Player 1 gets the hash from player 2
    browser1.setHash(player2Hash.substring(1))
    await new Promise(resolve => setTimeout(resolve, 0));

    // Assertions
    // 1. Shared states agree.
    expect(JSON.stringify(app1.gameState.shared)).toEqual(JSON.stringify(app2.gameState.shared))

    // 2. Player 1's collided tile has moved back to the rack.
    const final_p1_tile1_placement = app1.gameState.tilesHeld.find(p => p.tile === p1_tile1_placement.tile)
    expect(final_p1_tile1_placement?.row).toBe('rack')

    // 3. Player 1's other placed tile remains on its square.
    const final_p1_tile2_placement = app1.gameState.tilesHeld.find(p => p.tile === p1_tile2_placement.tile)
    expect(final_p1_tile2_placement?.row).toBe(7)
    expect(final_p1_tile2_placement?.col).toBe(8)
  })

  it('should sync player name changes', async () => {
    // Player 1's environment
    const browser1 = new TestBrowser()
    const app1 = new App(browser1)
    await app1.init()

    // Player 2's environment
    const browser2 = new TestBrowser()
    const app2 = new App(browser2)
    await app2.init()

    // Player 1 changes their name
    const newPlayer1Name = 'Sir Reginald'
    app1.gameState.changePlayerName('1', newPlayer1Name)

    // Player 1 passes their turn
    await app1.gameState.passOrExchange()
    const player1Hash = browser1.getHash()
    expect(player1Hash).toEqual(`#${new URLSearchParams([
      ['gid', app1.gameState.gameId],
      ['v', '0'],
      ['seed', String(app1.gameState.settings.tileSystemSettings.seed)],
      ['tn', '1'],
      ['ex', ''],
      ['p1n', 'Sir Reginald'],
    ])}`)

    // Player 2 gets the hash from player 1
    browser2.setHash(player1Hash.substring(1))
    await new Promise(resolve => setTimeout(resolve, 0));

    // Now, player 2's game state should be synced with player 1's
    expect(app2.gameState.players[0]!.name).toBe(newPlayer1Name)
    // And player 2's name should be unchanged.
    expect(app2.gameState.players[1]!.name).toBe(app1.gameState.players[1]!.name)
  })

  it('should sync player name changes after the first turn', async () => {
    // Player 1's environment
    const browser1 = new TestBrowser()
    const app1 = new App(browser1)
    await app1.init()
    const originalPlayer1Name = app1.gameState.players[0]!.name

    // Player 2's environment
    const browser2 = new TestBrowser()
    const app2 = new App(browser2)
    await app2.init()

    // Player 1 takes their first turn
    await app1.gameState.passOrExchange()
    const player1Hash1 = browser1.getHash()
    expect(player1Hash1).toEqual(`#${new URLSearchParams([
      ['gid', app1.gameState.gameId],
      ['v', '0'],
      ['seed', String(app1.gameState.settings.tileSystemSettings.seed)],
      ['tn', '1'],
      ['ex', ''],
    ])}`)

    // Player 2 syncs with Player 1
    browser2.setHash(player1Hash1.substring(1))
    await new Promise(resolve => setTimeout(resolve, 0));

    // At this point, Player 2 should see the original name
    expect(app2.gameState.players[0]!.name).toBe(originalPlayer1Name)

    // Now, Player 1 changes their name. This happens while it is Player 2's turn.
    const newPlayer1Name = 'Dame Judi'
    app1.gameState.changePlayerName('1', newPlayer1Name)

    // Player 2 takes their turn
    await app2.gameState.passOrExchange()
    const player2Hash = browser2.getHash()

    // Player 1 syncs with Player 2's turn
    browser1.setHash(player2Hash.substring(1))
    await new Promise(resolve => setTimeout(resolve, 0));

    // Now it's Player 1's turn again. Player 1 passes.
    // The pending name change will be included in this turn.
    await app1.gameState.passOrExchange()
    const player1Hash2 = browser1.getHash()
    expect(player1Hash2).toEqual(`#${new URLSearchParams([
      ['gid', app1.gameState.gameId],
      ['tn', '3'],
      ['ex', ''],
      ['p1n', 'Dame Judi'],
    ])}`)

    // Player 2 syncs with Player 1's second turn
    browser2.setHash(player1Hash2.substring(1))
    await new Promise(resolve => setTimeout(resolve, 0));

    // Now, Player 2 should see the new name
    expect(app2.gameState.players[0]!.name).toBe(newPlayer1Name)
  })
})
