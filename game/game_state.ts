/**
 * @file Game-specific information that gets stored in localStorage.
 * @description
 * Players take turns playing moves. Each player has a private browser
 * context, and the game is serverless, so players exchange move data
 * through an outside channel, such as chat. After each move, the game
 * must generate a "turn URL" for the local player to send to the other
 * players. The game must parse and apply turn URLs received.
 */

import { Settings } from './settings.js'
import { arraysEqual } from './validation.js'
import { SharedState, UrlError, parseGameParams } from './shared_state.js'
import { isBoardPlacement, isBoardPlacementRow, Tile } from './tile.js'
import type { TilePlacement, TilePlacementRow } from './tile.js'
import { Turn, toTurnNumber, updateTurnHistory } from './turn.js'
import type { TurnNumber, TurnData } from './turn.js'
import { indicesOk } from './validation.js'
import { TileEvent, GameEvent, BoardEvent } from './events.js'

export class GameState extends EventTarget {
  readonly shared: SharedState
  private inPlayTurns = false

  constructor(
    readonly playerId: string,  // The local player.
    settings?: Settings,
    public keepAllHistory = true,
    shared?: SharedState,
    readonly tilesHeld: Array<TilePlacement> = [],
    /**
     * The last N turns played, where N is at least
     * the number of players minus one. Turn URLs should describe the last move
     * made by each player except the player whose turn it is.
     */
    readonly history = [] as Array<TurnData>,
    private pendingExtraParams = new URLSearchParams,
  ) {
    super()
    if (!shared) {
      if (!settings) {
        throw new Error('New GameState requires either a Settings or a SharedState.')
      }
      shared = new SharedState(settings)
    }
    this.shared = shared
    if (!this.shared.settings.players.some(p => p.id === playerId)) {
      throw new Error(`Player ID "${playerId}" is not listed in settings.`)
    }
    this.board.addEventListener('tileplaced', (evt: Event) => {
      const { placement } = (evt as BoardEvent).detail
      const myTile = this.tilesHeld.find(p => p.row === placement.row && p.col === placement.col)
      if (myTile && myTile.tile !== placement.tile) {
        console.debug(`My tile at ${placement.row},${placement.col} is displaced. Moving it to rack.`)
        // toCol=0 is arbitrary, moveTile will find a spot.
        this.moveTile(myTile.row, myTile.col, 'rack', 0)
      }
    })
    this.tilesState.addEventListener('tiledraw', this.tiledraw.bind(this))
    this.tilesState.addEventListener('tilereturn', this.tilereturn.bind(this))
  }

  copyFrom(other: GameState) {
    // Assume that constant fields are equal.
    this.shared.copyFrom(other.shared)
    this.keepAllHistory = other.keepAllHistory  // TODO - Reconsider.
    this.tilesHeld.splice(0, this.tilesHeld.length, ...other.tilesHeld)
    this.history.splice(0, this.history.length, ...other.history)
    this.pendingExtraParams = other.pendingExtraParams
  }

  /**
   * Initializes `this.tilesHeld` from the shared game state.
   * @fires TileEvent#tilemove
   */
  async init() {
    const tiles = await this.tilesState.getTiles(this.playerId)
    this.tilesHeld.splice(0, this.tilesHeld.length, ...tiles.map((tile, index) => {
      return {
        tile,
        row: 'rack' as 'rack',
        col: index,
      }
    }))
    this.tilesHeld.forEach(p => {
      this.dispatchEvent(new TileEvent('tilemove', {detail: {placement: p}}))
    })
    return this
  }

  get gameId()             { return this.shared.gameId }
  get settings()           { return this.shared.settings }
  get nextTurnNumber()     { return this.shared.nextTurnNumber }
  get players()            { return this.shared.players }
  get board()              { return this.shared.board }
  get tilesState()         { return this.shared.tilesState }
  get numberOfTilesInBag() { return this.tilesState.numberOfTilesInBag }
  get isGameOver()         { return this.tilesState.isGameOver }
  get exchangeTilesCount() { return this.tilesHeld.filter(p => p.row === 'exchange').length }

  async getTiles(playerId: string) {
    return await this.tilesState.getTiles(playerId)
  }

  get turnUrlParams() {
    return this.shared.getTurnUrlParams(this.history.slice(1 - this.players.length))
  }

  getHistoryUrlParamsForPlayer(playerId: string) {
    return new URLSearchParams([['pid', playerId], ...this.shared.getTurnUrlParams(this.history)])
  }

  get playerWhoseTurnItIs() {
    if (this.isGameOver) return null
    return this.getPlayerForTurnNumber(this.nextTurnNumber)
  }

  getPlayerForTurnNumber(turnNumber: TurnNumber) {
    return this.shared.getPlayerForTurnNumber(turnNumber)
  }

  tiledraw(evt: any) {
    if (evt.detail.playerId === this.playerId) {
      console.debug(`I drew "${evt.detail.tile.letter}".`)
      const occupiedIndices = new Set(this.tilesHeld.filter(p => p.row === 'rack').map(p => p.col))
      for (let col = 0; col < this.settings.rackCapacity; ++col) {
        if (!occupiedIndices.has(col)) {
          this.tilesHeld.push({row: 'rack', col, tile: evt.detail.tile})
          return
        }
      }
      throw new Error(`No room for drawn tile! ${JSON.stringify(this.tilesHeld)}`)
    }
  }

  tilereturn(evt: any) {
    if (evt.detail.playerId === this.playerId) {
      let index = this.tilesHeld.findIndex(p => p.row === 'exchange' && p.tile.equals(evt.detail.tile))
      if (index === -1) index = this.tilesHeld.findIndex(p => p.tile.equals(evt.detail.tile))
      if (index === -1) {
        console.error(`Tile not found for exchange: ${JSON.stringify(evt.detail.tile)}`)
      } else {
        this.tilesHeld.splice(index, 1)
      }
    }
  }

  /**
   * Moves a held tile to an open board, rack, or exchange area location.
   * @throws {RangeError} if either location is invalid or the destination is full.
   * @fires TileEvent#tilemove
   */
  moveTile(
    fromRow: TilePlacementRow,
    fromCol: number,
    toRow: TilePlacementRow,
    toCol: number,
    assignedLetter?: string,
  ) {
    const preparation = this.prepareTileMove(fromRow, fromCol, toRow, toCol)
    if (!preparation.success) throw new RangeError(preparation.message)
    for (const pushed of preparation.toPush) {
      const pushedFromCol = pushed.col
      pushed.col = pushedFromCol + preparation.pushDirection
      this.dispatchEvent(new TileEvent('tilemove', {detail: {fromRow, fromCol: pushedFromCol, placement: pushed}}))
    }
    preparation.placement.row = preparation.toRow
    preparation.placement.col = preparation.toCol
    preparation.placement.assignedLetter = assignedLetter
    if (!isBoardPlacementRow(preparation.toRow)) {
      delete preparation.placement.assignedLetter
    }
    this.dispatchEvent(new TileEvent('tilemove', {detail: {fromRow, fromCol, placement: preparation.placement}}))
  }

  /**
   * Checks whether a tile at the given `from` location can move to the `to` location.
   */
  prepareTileMove(fromRow: TilePlacementRow, fromCol: number, toRow: TilePlacementRow, toCol: number): {
    success: true
    placement: TilePlacement      // The tile to move.
    toRow: TilePlacementRow       // The `toRow` argument, possibly adjusted.
    toCol: number                 // The `toCol` argument, possibly adjusted.
    toPush: Array<TilePlacement>  // The tiles, if any, that would move to make space.
    pushDirection: -1 | 1         // The direction of `toPush` tiles motion, left (-1) or right (1).
  } | {
    success: false
    message: string
  } {
    const placement = this.tilesHeld.find(p => p.row === fromRow && p.col === fromCol)
    if (placement === undefined) return {success: false, message: `No tile at ${fromRow},${fromCol}.`}
    let pushDirection: 1 | -1 = (toRow !== fromRow || toCol < fromCol ? 1 : -1)
    let toPush: Array<TilePlacement> = []
    const occupant = (
      // A drop at the pick-up location does not push tiles but supports letter reassignment.
      fromRow === toRow && fromCol === toCol
        ? undefined
        : this.tilesHeld.find(p => p.row === toRow && p.col === toCol)
    )

    // In the rack and exchange area, provided that there is room (which there will be, barring a bug),
    // we can always drop the tile at the specified position, but we may have to move other tiles.
    if (toRow === 'rack' || toRow === 'exchange') {
      const capacity = this.settings.rackCapacity
      if (!indicesOk(capacity, toCol)) return { success: false, message: `Invalid toCol: ${toCol}` }
      if (occupant) {
        const newRowmates = new Map(
          this.tilesHeld
            .filter(p => p.row === toRow && !(p.row === fromRow && p.col === fromCol))
            .map(p => [p.col, p])
        )
        if (toRow === fromRow && toCol > fromCol) {
          pushDirection = -1
        } else {
          pushDirection = 1
        }

        function tryPush() {
          const newToPush: Array<TilePlacement> = []
          for (let col = toCol; true; col += pushDirection) {
            if (col < 0 || col >= capacity) return null
            const rowmate = newRowmates.get(col)
            if (rowmate) newToPush.push(rowmate)
            else return newToPush
          }
        }

        let newToPush = tryPush()
        if (!newToPush) {
          pushDirection = -pushDirection as typeof pushDirection
          newToPush = tryPush()
          if (!newToPush) return {
            success: false,
            message: `${toRow === 'rack' ? 'Rack' : 'Exchange area'} is full.`,
          }
        }
        toPush = newToPush
      }
    } else {
      // Moving to the board. We won't move anything out of the way.
      const square = this.board.squares[toRow]?.[toCol]
      if (!square) return { success: false, message: `Tile destination ${toRow},${toCol} is off the board.` }
      if (occupant || square.tile) {
        // Try to substitute a good nearby open square.
        for (const [deltaRow, deltaCol] of [[0,1], [1,0], [-1,0], [0,-1]]) {
          const [row, col] = [toRow + deltaRow!, toCol + deltaCol!]
          const nearbySquare = this.board.squares[row]?.[col]
          if (!nearbySquare) continue
          if (nearbySquare.tile) continue
          if (this.tilesHeld.some(p => p.row === row && p.col === col)) continue
          return { success: true, placement, toRow: row, toCol: col, pushDirection, toPush }
        }
        return { success: false, message: `Square ${toRow},${toCol} is occupied` }
      }
    }
    return { success: true, placement, toRow, toCol, pushDirection, toPush }
  }

  /** Moves all uncommitted tiles back to the rack. */
  recallTiles() {
    const placedTiles = this.tilesHeld.filter(p => p.row !== 'rack')
    const occupiedRackSpots = new Set(this.tilesHeld.filter(p => p.row === 'rack').map(p => p.col))
    let nextFreeSpot = 0
    for (const placement of placedTiles) {
      // Find the next empty spot on the rack.
      while (occupiedRackSpots.has(nextFreeSpot)) {
        ++nextFreeSpot
      }
      if (nextFreeSpot >= this.settings.rackCapacity) {
        // Should not happen
        console.error('No space in rack to recall tile.')
        break
      }
      this.moveTile(placement.row, placement.col, 'rack', nextFreeSpot)
      ++nextFreeSpot
    }
  }

  /**
   * Forms a `playTiles` turn from the `heldTiles` currently on the board.
   * Passes the resulting `Turn` to `playTurns`.
   * @fires TileEvent#tilemove
   */
  async playWord() {
    const placements = this.tilesHeld.filter(isBoardPlacement)
    if (placements.length === 0) {
      // TODO - Consider dynamically enabling the Play Word button.
      throw new Error('Drag some tiles onto the board, and try again.')
    }
    const turn = new Turn(this.playerId, this.nextTurnNumber, { playTiles: placements })
    turn.extraParams = this.pendingExtraParams
    this.pendingExtraParams = new URLSearchParams
    await this.playTurns([turn])
  }

  /**
   * Forms a `exchangeTileIndices` turn from the `heldTiles` currently in the exchange area.
   * Passes the resulting `Turn` to `playTurns`.
   * @fires TileEvent#tilemove
   */
  async passOrExchange() {
    const placements = this.tilesHeld.map((p, index) => ({p, index})).filter(({p}) => p.row === 'exchange')
    const exchangeTileIndices = placements.map(({index}) => index)
    const turn = new Turn(this.playerId, this.nextTurnNumber, { exchangeTileIndices })
    turn.extraParams = this.pendingExtraParams
    this.pendingExtraParams = new URLSearchParams
    await this.playTurns([turn])
  }

  /**
   * Commits turns to the board and players' racks.
   * @fires TileEvent#tilemove
   * @fires GameEvent#turnchange
   * @fires GameEvent#gameover
   */
  private async playTurns(turns: Iterable<Turn>) {
    if (this.isGameOver) {
      throw new Error('Game Over.')
    }

    if (this.inPlayTurns) throw new Error(`playTurns: recursion detected.`)
    const json = this.toJSON()
    const oldNextTurnNumber = this.nextTurnNumber
    let ok = false
    try {
      this.inPlayTurns = true
      await this.doPlayTurns(turns)
      ok = true
    } finally {
      if (!ok) {
        console.log('Rolling back game state.')
        this.copyFrom(await GameState.fromJSON(json))
        this.dispatchEvent(new GameEvent('turnchange'))
      }
      this.inPlayTurns = false
    }
    if (this.nextTurnNumber !== oldNextTurnNumber) {
      this.dispatchEvent(new GameEvent('turnchange'))
    }
    if (this.isGameOver) {
      this.dispatchEvent(new GameEvent('gameover'))
    }
  }

  /**
   * Commits turns to the board and players' racks.
   * @fires TileEvent#tilemove
   */
  private async doPlayTurns(turns: Iterable<Turn>) {
    const newTurns: Array<Turn> = []
    let finalTurnNumber: TurnNumber | null = null

    // `this.shared.playTurns` validates several turn properties.
    // For example:
    // * It rejects turns whose `playerId` does not line up with the order of play.
    // * It rejects invalid tile placement combinations.
    // * It updates the board and scores.
    // * It updates nextTurnNumber after each successfully processed turn.
    // On success, it updates tiles state (i.e., racks) and the board.
    // TODO - Consider async generators.
    for (const turn of turns) {
      for (const newTurn of await this.shared.playTurns(turn)) {
        if (newTurn.playerId === this.playerId && 'playTiles' in newTurn.move) {
          for (const placement of newTurn.move.playTiles) {
            let index = this.tilesHeld.findIndex(p =>
              p.row === placement.row &&
                p.col === placement.col &&
                p.tile.equals(placement.tile))
            if (index === -1) index = this.tilesHeld.findIndex(p => p.tile.equals(placement.tile))
            if (index === -1) index = this.tilesHeld.findIndex(p => p.tile.isBlank)
            if (index === -1) throw new Error(`Could not find tile to place: ${JSON.stringify(placement)}`)
            this.tilesHeld.splice(index, 1)
          }
        }
        // Draw/exchange tiles between bag and racks.
        finalTurnNumber = await this.tilesState.playTurns(turn)
        newTurns.push(turn)
        if (finalTurnNumber !== null) break
      }
    }

    updateTurnHistory({
      history: this.history,
      nextTurnNumber: this.nextTurnNumber,
      finalTurnNumber,
      turns: newTurns,
    })
    if (finalTurnNumber !== null) {
      const finalTurnPlayerId = this.getPlayerForTurnNumber(finalTurnNumber).id
      console.log(`Player ${finalTurnPlayerId} ends game after turn ${finalTurnNumber}.`)
      let allTilesSum = 0
      for (const player of this.players) {
        if (player.id !== finalTurnPlayerId) {
          const playerTiles = await this.getTiles(player.id)
          const tilesSum = playerTiles.reduce((sum, curr) => sum + curr.value, 0)
          this.board.scores.set(player.id, (this.board.scores.get(player.id) ?? 0) - tilesSum)
          console.log(`Transfering ${tilesSum} from Player ${player.id}.`)
          allTilesSum += tilesSum
        }
      }
      console.log(`Transfering ${allTilesSum} to Player ${finalTurnPlayerId}.`)
      this.board.scores.set(finalTurnPlayerId, (this.board.scores.get(finalTurnPlayerId) ?? 0) + allTilesSum)
    }
    if (!this.keepAllHistory) {
      const turnsToKeep = this.players.length - 1;
      if (turnsToKeep > 0 && this.history.length > turnsToKeep) {
        this.history.splice(0, this.history.length - turnsToKeep);
      }
    }
  }

  changePlayerName(playerId: string, name: string) {
    const playerIndex = this.players.findIndex(p => p.id === playerId)
    if (playerIndex === -1) {
      throw new Error(`Player with ID ${playerId} not found.`)
    }
    const player = this.players[playerIndex]!
    if (player.name !== name) {
      player.name = name
      this.pendingExtraParams.set(`p${playerIndex + 1}n`, name)
      this.dispatchEvent(new GameEvent('turnchange'))
    }
  }

  async applyTurnParams(params: URLSearchParams) {
    if (this.isGameOver) return
    const iterator = params[Symbol.iterator]()
    let urlTurnNumberStr
    for (const [key, value] of iterator) {
      if (key !== 'tn') continue
      urlTurnNumberStr = value
      break
    }
    if (!urlTurnNumberStr) {
      console.info('applyTurnParams: no turn number found.')
      return
    }
    const turnNumber = toTurnNumber(parseInt(urlTurnNumberStr))
    if (isNaN(turnNumber)) {
      throw new UrlError(`"tn" param is not a turn number: "${urlTurnNumberStr}"`)
    }
    await this.playTurns(this.shared.turnsFromParams(iterator, turnNumber))
  }

  static async fromParams(params: Readonly<URLSearchParams>) {
    const { settings, playerId, turnParams } = await parseGameParams(params)
    const gameState = new GameState(playerId, settings)
    await gameState.init()
    await gameState.applyTurnParams(turnParams)
    return gameState
  }

  toJSON() {
    return {
      shared: this.shared.toJSON(),
      playerId: this.playerId,
      keepAllHistory: this.keepAllHistory,
      tilesHeld: this.tilesHeld.map((placement: TilePlacement) => {
        const json = {
          tile: placement.tile.toJSON(),
          row: placement.row,
          col: placement.col,
        } as any
        if (placement.assignedLetter) json.assignedLetter = placement.assignedLetter
        return json
      }),
      history: this.history.map(turnData => {
        return {turnNumber: turnData.turnNumber, params: turnData.paramsStr}
      }),
      pendingExtraParams: this.pendingExtraParams.toString(),
    }
  }

  static async fromJSON(json: any) {
    function fail(msg: string): never {
      throw new TypeError(`${msg} in GameState serialization: ${JSON.stringify(json)}`)
    }
    if (typeof json !== 'object') fail('Not an object')
    if (!arraysEqual(
      [...Object.keys(json)],
      ['shared', 'playerId', 'keepAllHistory', 'tilesHeld', 'history', 'pendingExtraParams']
    )) {
      fail('Wrong keys or key order')
    }
    if (typeof json.playerId !== 'string') fail('Player ID is not a string')
    if (typeof json.keepAllHistory !== 'boolean') fail('keepAllHistory is not a boolean')
    if (!Array.isArray(json.tilesHeld)) fail('tilesHeld is not an array')
    if (!Array.isArray(json.history)) fail('History is not an array')
    if (typeof json.pendingExtraParams !== 'string') fail('pendingExtraParams is not a string')

    const tilesHeld = json.tilesHeld.map((tileJson: any) => {
      if (typeof tileJson !== 'object') fail('tilesHeld element is not an object')
      if (!arraysEqual(
        [...Object.keys({...tileJson, assignedLetter:'x'})],
        ['tile', 'row', 'col', 'assignedLetter']
      )) {
        fail('Wrong tilesHeld element keys or key order')
      }
      if (typeof tileJson.row !== 'number' && tileJson.row !== 'rack' && tileJson.row !== 'exchange') {
        fail('Invalid tilesHeld[].row')
      }
      if (typeof tileJson.col !== 'number') fail('Invalid tilesHeld[].col')
      if (tileJson.assignedLetter !== undefined && typeof tileJson.assignedLetter !== 'string') {
        fail('Invalid tilesHeld[].assignedLetter')
      }
      const tile = Tile.fromJSON(tileJson.tile)
      if (tile.letter && tileJson.assignedLetter) fail('Non-blank tile with an assigned letter')
      const result: TilePlacement = {
        tile,
        row: tileJson.row,
        col: tileJson.col,
      }
      if (tileJson.assignedLetter) result.assignedLetter = tileJson.assignedLetter
      return result
    })
    const history = json.history.map((turnDataJson: any) => {
      if (!arraysEqual([...Object.keys(turnDataJson)], ['turnNumber', 'params'])) {
        fail('Wrong history element keys or key order')
      }
      if (typeof turnDataJson.turnNumber !== 'number') fail('turnNumber is not a number')
      if (typeof turnDataJson.params !== 'string') fail('params is not a string')
      return {turnNumber: toTurnNumber(turnDataJson.turnNumber), paramsStr: turnDataJson.params}
    })

    const gameState = new GameState(
      json.playerId,
      undefined,  // settings
      json.keepAllHistory,
      SharedState.fromJSON(json.shared),
      tilesHeld,
      history,
      new URLSearchParams(json.pendingExtraParams),
    )
    await gameState.init()
    return gameState
  }
}
