import { expect, describe, it } from 'bun:test'
import { TestBrowser } from './test_browser.js'
import { fromTurnNumber } from './game/turn.js'

describe('multi-player', () => {
  it('should allow two players to take turns', async () => {
    // Player 1's environment
    const browser1 = new TestBrowser()
    await browser1.init()
    let app1 = browser1.app

    // Player 2's environment
    const browser2 = new TestBrowser()
    await browser2.init()
    let app2 = browser2.app

    // Player 1 starts a game, which creates a hash.
    expect(browser1.getHash()).not.toBe('')
    expect(fromTurnNumber(app1.gameState.nextTurnNumber)).toBe(1)

    // Player 1 passes their turn
    await app1.gameState.passOrExchange()

    expect(fromTurnNumber(app1.gameState.nextTurnNumber)).toBe(2);
    const player1Hash = browser1.getHash()
    expect(player1Hash).not.toBe('')

    // Player 2 gets the hash from player 1 (e.g. via a chat message)
    await browser2.setHash(player1Hash)
    app2 = browser2.app

    // Now, player 2's game state should be synced with player 1's
    expect(JSON.stringify(app2.gameState.shared)).toEqual(JSON.stringify(app1.gameState.shared))

    // Player 2 makes a move
    await app2.gameState.passOrExchange()

    expect(fromTurnNumber(app2.gameState.nextTurnNumber)).toBe(3);
    const player2Hash = browser2.getHash()
    expect(player2Hash).not.toBe(player1Hash)

    // Player 1 gets the hash from player 2
    await browser1.setHash(player2Hash)
    app1 = browser1.app

    // Now, player 1's game state should be synced with player 2's
    expect(JSON.stringify(app1.gameState.shared)).toEqual(JSON.stringify(app2.gameState.shared))
  })

  it('should allow tab closure between turns', async () => {
    // Player 1's environment
    const browser1 = new TestBrowser()
    await browser1.init()
    const app1 = browser1.app

    // Player 2's environment
    const browser2 = new TestBrowser()
    await browser2.init()
    let app2 = browser2.app

    // Player 1 passes their turn
    await app1.gameState.passOrExchange()
    const player1Hash = browser1.getHash()

    // Player 2 gets the hash from player 1 (e.g. via a chat message)
    await browser2.setHash(player1Hash)
    app2 = browser2.app

    // Player 2 makes a move
    await app2.gameState.passOrExchange()
    const player2Hash = browser2.getHash()

    // Player 1 opens the URL from player 2 in another tab
    const reloadedApp1 = await browser1.load(player2Hash)

    // Now, player 1's game state should be synced with player 2's
    expect(reloadedApp1.gameState.shared.toJSON()).toEqual(app2.gameState.shared.toJSON())
  })

  it('should generate a full history URL', async () => {
    // Player 1 begins a game and plays wl=7.7&wh=AA
    const gameParams = 'gid=test&seed=1&bag=A-30-1&p1n=P1&p2n=P2&p3n=P3'
    const browser1 = new TestBrowser('#' + gameParams)
    await browser1.init()
    let app1 = browser1.app
    app1.gameState.moveTile('rack', 0, 7, 7)
    app1.gameState.moveTile('rack', 1, 7, 8)
    await app1.gameState.playWord()

    // Player 2 joins and plays wl=8.8&wh=AA
    const browser2 = new TestBrowser(browser1.getHash())
    await browser2.init()
    const app2 = browser2.app
    app2.gameState.moveTile('rack', 0, 8, 8)
    app2.gameState.moveTile('rack', 1, 8, 9)
    await app2.gameState.playWord()

    console.log(`browser2: ${browser2.getHash()}`)

    // Player 3 joins and plays wl=9.7&wh=AA
    const browser3 = new TestBrowser(browser2.getHash())
    await browser3.init()
    const app3 = browser3.app
    app3.gameState.moveTile('rack', 0, 9, 7)
    app3.gameState.moveTile('rack', 1, 9, 8)
    await app3.gameState.playWord()

    // Player 1 plays wl=7.6&wv=AA
    await browser1.setHash(browser3.getHash())
    app1 = browser1.app
    app1.gameState.moveTile('rack', 0, 7, 6)
    app1.gameState.moveTile('rack', 1, 8, 6)
    await app1.gameState.playWord()

    const gameUrl2 = app1.gameState.getHistoryUrlParamsForPlayer('2')
    expect([...gameUrl2.entries()]).toEqual([
      ['pid', '2'],
      ['gid', 'test'],
      ['v', '0'],
      ['p1n', 'P1'],
      ['p2n', 'P2'],
      ['p3n', 'P3'],
      ['bag', 'A-30-1'],
      ['seed', '1'],
      ['tn', '1'],
      ['wl', '7.7'], ['wh', 'AA'],
      ['wl', '8.8'], ['wh', 'AA'],
      ['wl', '9.7'], ['wh', 'AA'],
      ['wl', '7.6'], ['wv', 'AA'],
    ])

    // Player 2 loads Player 1's turn URL.
    await browser2.setHash(browser1.getHash())

    // Player 2 catches up in another browser.
    const browser2b = new TestBrowser('#' + gameUrl2)
    const app2b = await browser2b.load('#' + gameUrl2)
    expect(app2b.gameState.toJSON()).toEqual(browser2.app.gameState.toJSON())

    // Player 1 accidentally loads Player 2's URL.
    await browser1.setHash('#' + gameUrl2)
    app1 = browser1.app
    expect(app1.gameState.playerId).toEqual('1')  // Still showing Player 1's tiles.
  })

  it('should handle collisions in pending placements', async () => {
    // Player 1's environment
    const browser1 = new TestBrowser()
    await browser1.init()
    let app1 = browser1.app

    // Player 2's environment
    const browser2 = new TestBrowser()
    await browser2.init()
    let app2 = browser2.app

    // Player 1 places two tiles near the center
    const p1_tile1_placement = app1.gameState.tilesHeld.find(p => p.row === 'rack')!
    app1.gameState.moveTile(p1_tile1_placement.row, p1_tile1_placement.col, 7, 7)
    const p1_tile2_placement = app1.gameState.tilesHeld.find(p => p.row === 'rack')!
    app1.gameState.moveTile(p1_tile2_placement.row, p1_tile2_placement.col, 7, 8)

    // Player 1 passes their turn. The pending placements are not part of the turn.
    await app1.gameState.passOrExchange()
    const player1Hash = browser1.getHash()

    // Player 2 gets the hash from player 1
    await browser2.setHash(player1Hash)
    app2 = browser2.app

    // Player 2's board is empty. Player 2 makes a valid move on the center square.
    const p2_tile1_placement = app2.gameState.tilesHeld.find(p => p.row === 'rack')!
    app2.gameState.moveTile(p2_tile1_placement.row, p2_tile1_placement.col, 7, 7)
    const p2_tile2_placement = app2.gameState.tilesHeld.find(p => p.row === 'rack')!
    app2.gameState.moveTile(p2_tile2_placement.row, p2_tile2_placement.col, 8, 7)
    await app2.gameState.playWord()
    const player2Hash = browser2.getHash()

    // Player 1 gets the hash from player 2
    await browser1.setHash(player2Hash)
    app1 = browser1.app

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

  it('should recover from an out-of-order turn', async () => {
    // Player 1 begins a game and plays wl=7.7&wh=AA
    const gameParams = 'gid=test&seed=1&bag=A-30-1&p1n=P1&p2n=P2&p3n=P3'
    const browser1 = new TestBrowser('#' + gameParams)
    await browser1.init()
    const app1 = browser1.app
    app1.gameState.moveTile('rack', 0, 7, 7)
    app1.gameState.moveTile('rack', 1, 7, 8)
    await app1.gameState.playWord()

    // Player 1 tries to play a word after their turn.
    app1.gameState.moveTile('rack', 0, 8, 8)
    const selector = '[data-row="8"][data-col="8"].placed'
    app1.view.renderBoard()
    expect(browser1.getDocument().querySelector(selector)).toBeTruthy()
    await expect(async () => await app1.gameState.playWord()).toThrow(
      'Turn number 2 belongs to player "2", not "1".')
    await new Promise(resolve => setTimeout(resolve, 0));

    // After the error, the tile should remain where placed.
    expect(browser1.getDocument().querySelector(selector)).toBeTruthy()
    expect(app1.gameState.tilesHeld.find(p => p.row === 8 && p.col === 8)).toBeTruthy()
  })

  describe('player name change', () => {
    it('should sync player name changes', async () => {
      // Player 1's environment
      const browser1 = new TestBrowser()
      await browser1.init()
      const app1 = browser1.app

      // Player 2's environment
      const browser2 = new TestBrowser()
      await browser2.init()
      let app2 = browser2.app

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
      await browser2.setHash(player1Hash)
      app2 = browser2.app

      // Now, player 2's game state should be synced with player 1's
      expect(app2.gameState.players[0]!.name).toBe(newPlayer1Name)
      // And player 2's name should be unchanged.
      expect(app2.gameState.players[1]!.name).toBe(app1.gameState.players[1]!.name)
    })

    it('should sync player name changes after the first turn', async () => {
      // Player 1's environment
      const browser1 = new TestBrowser()
      await browser1.init()
      let app1 = browser1.app
      const originalPlayer1Name = app1.gameState.players[0]!.name

      // Player 2's environment
      const browser2 = new TestBrowser()
      await browser2.init()
      let app2 = browser2.app

      // Player 1 takes their first turn
      await app1.gameState.passOrExchange()
      const player1Hash1 = browser1.getHash()
      expect(player1Hash1).toEqual('#' + new URLSearchParams([
        ['gid', app1.gameState.gameId],
        ['v', '0'],
        ['seed', String(app1.gameState.settings.tileSystemSettings.seed)],
        ['tn', '1'],
        ['ex', ''],
      ]))

      // Player 2 syncs with Player 1
      await browser2.setHash(player1Hash1)
      app2 = browser2.app

      // At this point, Player 2 should see the original name
      expect(app2.gameState.players[0]!.name).toBe(originalPlayer1Name)

      // Now, Player 1 changes their name. This happens while it is Player 2's turn.
      const newPlayer1Name = 'Dame Judi'
      app1.gameState.changePlayerName('1', newPlayer1Name)

      // Player 2 takes their turn
      await app2.gameState.passOrExchange()
      const player2Hash = browser2.getHash()

      // Player 1 syncs with Player 2's turn
      await browser1.setHash(player2Hash)
      app1 = browser1.app

      // Now it's Player 1's turn again. Player 1 passes.
      // The pending name change will be included in this turn.
      await app1.gameState.passOrExchange()
      const player1Hash2 = browser1.getHash()
      expect(player1Hash2).toEqual('#' + new URLSearchParams([
        ['gid', app1.gameState.gameId],
        ['tn', '3'],
        ['ex', ''],
        ['p1n', 'Dame Judi'],
      ]))

      // Player 2 syncs with Player 1's second turn
      await browser2.setHash(player1Hash2)
      app2 = browser2.app

      // Now, Player 2 should see the new name
      expect(app2.gameState.players[0]!.name).toBe(newPlayer1Name)
    })

    it('should sync player name changes after a reload', async () => {
      // Player 1's environment
      const browser1 = new TestBrowser()
      await browser1.init()
      let app1 = browser1.app
      const originalPlayer1Name = app1.gameState.players[0]!.name

      // Player 2's environment
      const browser2 = new TestBrowser()
      await browser2.init()
      let app2 = browser2.app

      // Player 1 takes their first turn
      await app1.gameState.passOrExchange()
      const player1Hash1 = browser1.getHash()

      // Player 2 syncs with Player 1
      await browser2.setHash(player1Hash1)
      app2 = browser2.app

      // At this point, Player 2 should see the original name
      expect(app2.gameState.players[0]!.name).toBe(originalPlayer1Name)

      // Now, Player 1 changes their name. This happens while it is Player 2's turn.
      const newPlayer1Name = 'Dame Judi'
      app1.gameState.changePlayerName('1', newPlayer1Name)

      // Player 2 takes their turn
      await app2.gameState.passOrExchange()
      const player2Hash = browser2.getHash()

      // Player 1 syncs with Player 2's turn
      await browser1.setHash(player2Hash)
      app1 = browser1.app

      // Player 1 reloads the page.
      await browser1.reload()
      const reloadedApp1 = browser1.app

      // Now it's Player 1's turn again. Player 1 passes.
      // The pending name change will be included in this turn.
      await reloadedApp1.gameState.passOrExchange()
      const player1Hash2 = browser1.getHash()
      expect(player1Hash2).toEqual('#' + new URLSearchParams([
        ['gid', reloadedApp1.gameState.gameId],
        ['tn', '3'],
        ['ex', ''],
        ['p1n', 'Dame Judi'],
      ]))

      // Player 2 syncs with Player 1's second turn
      await browser2.setHash(player1Hash2)
      app2 = browser2.app

      // Now, Player 2 should see the new name
      expect(app2.gameState.players[0]!.name).toBe(newPlayer1Name)
    })
  })
})
