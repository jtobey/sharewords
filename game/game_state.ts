/**
 * @file Game-specific information that gets stored in localStorage.
 * @description
 * Players take turns playing moves. Each player has a private browser
 * context, and the game is serverless, so players exchange move data
 * through an outside channel, such as chat. After each move, the game
 * must generate a "turn URL" for the local player to send to the other
 * players. The game must parse and apply turn URLs received.
 */

import { Settings, toGameId } from './settings.js'
import type { GameId } from './settings.js'
import { Board } from './board.js'
import { arraysEqual, objectsEqual } from './validation.js'
import { SharedState } from './shared_state.js'
import { isBoardPlacement, isBoardPlacementRow, Tile } from './tile.js'
import type { TilePlacement, TilePlacementRow, BoardPlacement } from './tile.js'
import { Player } from './player.js'
import { Turn, toTurnNumber, fromTurnNumber, nextTurnNumber } from './turn.js'
import type { TurnNumber } from './turn.js'
import { indicesOk } from './validation.js'
import { TileEvent, GameEvent, BoardEvent, BagEvent } from './events.js'

type TurnData = {turnNumber: TurnNumber, params: string}

export class GameState extends EventTarget {
  readonly shared: SharedState
  private pendingExtraParams = new URLSearchParams

  constructor(
    readonly playerId: string,  // The local player.
    settings?: Settings,
    public keepAllHistory = false,
    shared?: SharedState,
    readonly tilesHeld: Array<TilePlacement> = [],
    /**
     * The last N turns played, where N is at least
     * the number of players minus one. Turn URLs should describe the last move
     * made by each player except the player whose turn it is.
     */
    readonly history = [] as Array<TurnData>,
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
        console.log(`My tile at ${placement.row},${placement.col} is displaced. Moving it to rack.`)
        // toCol=0 is arbitrary, moveTile will find a spot.
        this.moveTile(myTile.row, myTile.col, 'rack', 0)
      }
    })
    this.tilesState.addEventListener('tiledraw', this.tiledraw.bind(this))
    this.tilesState.addEventListener('tilereturn', this.tilereturn.bind(this))
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
    const gameParams = new URLSearchParams([['gid', this.gameId]])
    const turnHistory = this.history.slice(1 - this.players.length)
    const firstHistoryTurnNumber = turnHistory[0]?.turnNumber
    // Include game settings in the URL at the start of the game.
    if (firstHistoryTurnNumber === undefined || firstHistoryTurnNumber === toTurnNumber(1)) {
      this.addGameParams(gameParams)
    }
    if (turnHistory.length) {
      gameParams.append('tn', String(firstHistoryTurnNumber))
      const turnParams = [] as Array<URLSearchParams>
      turnHistory.forEach((turnData: TurnData) => {
        turnParams.push(new URLSearchParams(turnData.params))
      })
      const flatTurnParams = turnParams.map((p: URLSearchParams) => [...p]).flat()
      return new URLSearchParams([...gameParams, ...flatTurnParams])
    } else {
      gameParams.append('tn', '1')
      return gameParams
    }
  }

  get playerWhoseTurnItIs() {
    if (this.isGameOver) return null
    return this.players[(fromTurnNumber(this.nextTurnNumber) - 1) % this.players.length]
  }

  tiledraw(evt: any) {
    if (evt.detail.playerId === this.playerId) {
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
      const index = this.tilesHeld.findIndex(p => p.row === 'exchange' && p.tile.equals(evt.detail.tile))
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
    await this.playTurns(turn)
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
    await this.playTurns(turn)
  }

  recallTiles() {
    const rackSpots = new Set(this.tilesHeld.filter(p => p.row === 'rack').map(p => p.col))
    const placedTiles = this.tilesHeld.filter(p => p.row !== 'rack')
    for (const placement of placedTiles) {
      let rackCol = 0
      while (rackSpots.has(rackCol)) {
        rackCol++
      }
      if (rackCol >= this.settings.rackCapacity) {
        // Should not happen
        console.error('No space in rack to recall tile')
        break
      }
      const fromRow = placement.row
      const fromCol = placement.col
      placement.row = 'rack'
      placement.col = rackCol
      rackSpots.add(rackCol)
      this.dispatchEvent(new TileEvent('tilemove', {detail: {fromRow, fromCol, placement}}))
    }
  }

  /**
   * Commits turns to the board and players' racks.
   * @fires TileEvent#tilemove
   * @fires GameEvent#turnchange
   * @fires GameEvent#gameover
   */
  private async playTurns(...turns: Array<Turn>) {
    if (this.isGameOver) {
      throw new Error('Game Over.')
    }

    // `this.shared.playTurns` validates several turn properties.
    // For example:
    // * It rejects turns whose `playerId` does not line up with the order of play.
    // * It rejects invalid tile placement combinations.
    // * It updates the board and scores.
    // * It updates nextTurnNumber after each successfully processed turn.
    // On success, it updates tiles state (i.e., racks) and the board.
    turns = await this.shared.playTurns(...turns)
    for (const turn of turns) {
      if (turn.playerId === this.playerId && 'playTiles' in turn.move) {
        for (const placement of turn.move.playTiles) {
          const index = this.tilesHeld.findIndex(p => p.row === placement.row && p.col === placement.col)
          // TODO - Disable tile moves during the above `await`.
          if (index === -1) throw new Error(`Could not find tile to place: ${JSON.stringify(placement)}`)
          this.tilesHeld.splice(index, 1)
        }
      }
    }
    // Draw/exchange tiles between bag and racks.
    await this.tilesState.playTurns(...turns)

    // Update history.
    let wroteHistory = false
    for (const turn of turns) {
      // Convert {playerId, turnNumber, move} to TurnData.
      if (fromTurnNumber(turn.turnNumber) >= this.nextTurnNumber) {
        // `this.shared.playTurns` must have returned early.
        break
      }
      if (this.history.length && fromTurnNumber(turn.turnNumber) <= fromTurnNumber(this.history.slice(-1)[0]!.turnNumber)) {
        continue
      }
      const params = new URLSearchParams
      const addExtra = () => {
        if (turn.extraParams) {
          for (const [key, value] of turn.extraParams) {
            params.set(key, value)
          }
        }
      }
      if ('playTiles' in turn.move) {
        params.set('wl', `${turn.row}.${turn.col}`)
        addExtra()
        if (turn.blanks?.length) params.set('bt', turn.blanks.join('.'))
        // Keep the word last so that it stands out in the URL.
        params.set(turn.vertical ? 'wv' : 'wh', turn.mainWord!)
      } else if ('exchangeTileIndices' in turn.move) {
        params.set('ex', turn.move.exchangeTileIndices.join('.'))
        addExtra()
      }
      this.history.push({turnNumber: turn.turnNumber, params: String(params)})
      wroteHistory = true
      if (this.isGameOver) {
        console.log(`Player ${turn.playerId} ends game after turn ${turn.turnNumber}.`)
        let allTilesSum = 0
        for (const player of this.players) {
          if (player.id !== turn.playerId) {
            const playerTiles = await this.getTiles(player.id)
            const tilesSum = playerTiles.reduce((sum, curr) => sum + curr.value, 0)
            this.board.scores.set(player.id, (this.board.scores.get(player.id) ?? 0) - tilesSum)
            console.log(`Transfering ${tilesSum} from Player ${player.id}.`)
            allTilesSum += tilesSum
          }
        }
        console.log(`Transfering ${allTilesSum} to Player ${turn.playerId}.`)
        this.board.scores.set(turn.playerId, (this.board.scores.get(turn.playerId) ?? 0) + allTilesSum)
        this.dispatchEvent(new GameEvent('gameover'))
        break
      }
    }
    if (!this.keepAllHistory) {
      const turnsToKeep = this.players.length - 1;
      if (turnsToKeep > 0 && this.history.length > turnsToKeep) {
        this.history.splice(0, this.history.length - turnsToKeep);
      }
    }
    if (wroteHistory) this.dispatchEvent(new GameEvent('turnchange'))
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
    const turns = [] as Array<Turn>
    let urlTurnNumber = parseInt(urlTurnNumberStr)
    let wordLocationStr: string | null = null
    let blankTileIndicesStr: string | null = null
    let direction: null | 'wv' | 'wh' = null
    let wordPlayed: string | null = null
    let exchangeIndicesStr: string | null = null
    const processPendingMoveIfAny = () => {
      const playerId = this.players[(urlTurnNumber - 1) % this.players.length]!.id
      if (wordPlayed && direction && wordLocationStr) {
        if (exchangeIndicesStr) {
          throw new Error(`URL contains both word and exchange data for turn ${urlTurnNumber}`)
        }
        const blankTileAssignments = [] as Array<string>
        if (blankTileIndicesStr) {
          blankTileIndicesStr.split('.').forEach((s: string) => {
            const match = s.match(/^(\d+)$/)
            if (!match) { throw new Error(`Invalid "bt" URL parameter component: ${s}`) }
            const index = parseInt(match[1]!)
            if (index in blankTileAssignments) {
              throw new Error(`Duplicate blank tile assignment index: bt=${blankTileIndicesStr}`)
            }
            const assignedLetter = wordPlayed![index]
            if (!assignedLetter) {
              throw new RangeError(`Blank tile assignment index ${index} out of range: no "${wordPlayed}"[${index}].`)
            }
            blankTileAssignments[index] = assignedLetter
          })
        }
        const match = wordLocationStr.match(/^(\d+)\.(\d+)$/)
        if (!match) { throw new Error(`Invalid wl parameter in URL: ${wordLocationStr}`) }
        let row = parseInt(match[1]!)
        let col = parseInt(match[2]!)
        const placements = [] as Array<BoardPlacement>
        wordPlayed.split('').map((letter, letterIndex) => {
          const square = this.board.squares[row]?.[col]
          if (!square) throw new RangeError(`Attempted to play a word out of bounds: ${row},${col}.`)
          if (!square.tile) {
            // It must be a new tile from the player's rack.
            const assignedLetter = blankTileAssignments[letterIndex] ?? ''
            if (assignedLetter) {
              placements.push({tile: new Tile({letter: '', value: 0}), row, col, assignedLetter})
            } else {
              const value = this.settings.letterValues[letter]
              if (value === undefined) throw new Error(`Attempt to play an invalid letter: "${letter}"`)
              placements.push({tile: new Tile({letter, value}), row, col})
            }
          } else if (square.letter !== letter) {
            throw new Error(`Attempt word requires "${letter}" at ${row},${col}, but "${square.letter}" is there.`)
          }
          if (direction === 'wv') { row += 1 }
          else { col += 1 }
        })
        if (blankTileAssignments.length > wordPlayed!.length) {
          throw new RangeError(
            `"bt" URL parameter has index ${blankTileAssignments.length - 1} out of range 0-${wordPlayed!.length - 1}`
          )
        }
        turns.push(new Turn(playerId, toTurnNumber(urlTurnNumber), {playTiles: placements}))
      } else if (exchangeIndicesStr != null) {
        if (wordPlayed || direction || wordLocationStr || blankTileIndicesStr) {
          throw new Error(
            `Incomplete URL data for turn ${urlTurnNumber}: wl=${wordLocationStr} ${direction}=${wordPlayed} bt=${blankTileIndicesStr}`)
        }
        const exchangeIndexStrs = exchangeIndicesStr ? exchangeIndicesStr.split('.') : []
        const numberOfTilesInRack = this.tilesState.countTiles(playerId)
        const exchangeTileIndices = exchangeIndexStrs.map(s => parseInt(s, 10))
        exchangeTileIndices.forEach((index: number) => {
          if (isNaN(index) || index < 0 || index >= numberOfTilesInRack) {
            throw new RangeError(`Exchange tile index ${index} in URL is out of range 0-${numberOfTilesInRack - 1}`)
          }
        })
        turns.push(new Turn(playerId, toTurnNumber(urlTurnNumber), {exchangeTileIndices}))
      } else {
        // Nothing to see here, don't bump the turn number.
        return
      }
      urlTurnNumber++
      wordLocationStr = null
      blankTileIndicesStr = null
      direction = null
      wordPlayed = null
      exchangeIndicesStr = null
    }
    for (const [key, value] of iterator) {
      const pnMatch = key.match(/^p(\d+)n$/)
      if (pnMatch) {
        const playerIndex = parseInt(pnMatch[1]!) - 1
        const player = this.players[playerIndex]
        if (player) {
          player.name = value
        } else {
          throw new Error(`Invalid turn URL: Player ID "${pnMatch[1]}" should be in 1-${this.players.length}.`)
        }
      } else if (key === 'wl') {
        // `wl` marks a new word play move.
        processPendingMoveIfAny()
        wordLocationStr = value
      } else if (key === 'ex') {
        // `ex` marks a new pass/exchange move.
        processPendingMoveIfAny()
        exchangeIndicesStr = value
      } else if (key === 'bt') {
        if (blankTileIndicesStr) {
          throw new Error(`Duplicate "bt" parameter in URL data for turn ${urlTurnNumber}`)
        }
        blankTileIndicesStr = value
      } else if (key === 'wv' || key === 'wh') {
        if (direction) {
          throw new Error(`Duplicate word parameters in URL data for turn ${urlTurnNumber}`)
        }
        direction = key
        wordPlayed = value
      } else {
        throw new Error(`Invalid turn URL: Unrecognized parameter name: "${key}"`)
      }
    }
    // We are out of turn params.
    processPendingMoveIfAny()
    this.dispatchEvent(new GameEvent('turnchange'))
    await this.playTurns(...turns)
  }

  private addGameParams(params: URLSearchParams) {
    // Not all players have played. Include any non-default game settings.
    const defaults = new Settings
    params.set('v', this.settings.version)
    if (!playersEqual(this.settings.players, defaults.players)) {
      this.settings.players.forEach((p, index) => {
        params.set(`p${index + 1}n`, p.name)
      })
    }
    if (!arraysEqual(this.settings.boardLayout, defaults.boardLayout, false)) {
      params.set('board', this.settings.boardLayout.join('-'))
    }
    if (this.settings.bingoBonus !== defaults.bingoBonus) {
      params.set('bingo', String(this.settings.bingoBonus))
    }
    if (!(
      objectsEqual(this.settings.letterCounts, defaults.letterCounts) &&
        objectsEqual(this.settings.letterValues, defaults.letterValues)
    )) {
      const bagParam = Object.entries(this.settings.letterCounts).map(
        ([letter, count]) => `${letter}-${count}-${this.settings.letterValues[letter] ?? 0}`
      ).join('.')
      params.set('bag', bagParam)
    }
    if (this.settings.rackCapacity !== defaults.rackCapacity) {
      params.set('racksize', String(this.settings.rackCapacity))
    }
    if (this.settings.tileSystemType === 'honor') {
      params.set('seed', this.settings.tileSystemSettings.seed)
    }
    if (this.settings.dictionaryType !== defaults.dictionaryType) {
      params.set('dt', this.settings.dictionaryType)
    }
    if (typeof this.settings.dictionarySettings === 'string') {
      params.set('ds', this.settings.dictionarySettings)
    }
  }

  static async fromParams(allParams: Readonly<URLSearchParams>, playerId?: string) {
    // Everything up to `tn` is a game param. Everything after `tn` is a turn param.
    const gameParams = new URLSearchParams
    const turnParams = new URLSearchParams
    for (const [name, value] of allParams) {
      if (turnParams.size || name === 'tn') {
        turnParams.append(name, value)
      } else {
        gameParams.append(name, value)
      }
    }
    const settings = new Settings
    const vParam = gameParams.get('v')
    if (vParam && vParam !== settings.version) {
      throw new Error(`Protocol version not supported: ${vParam}`)
    }
    const gidParam = gameParams.get('gid')
    if (gidParam) settings.gameId = toGameId(gidParam)
    const newPlayers: Array<Player> = []
    for (let playerNumber = 1; ; ++playerNumber) {
      const pnParam = gameParams.get(`p${playerNumber}n`)
      if (!pnParam) break
      newPlayers.push(new Player({id: String(playerNumber), name: pnParam.slice(0, settings.maxPlayerNameLength)}))
    }
    if (newPlayers.length) settings.players = newPlayers
    const bagParam = gameParams.get('bag')
    if (bagParam) {
      const letterCounts: {[key: string]: number} = {}
      const letterValues: {[key: string]: number} = {}
      const lettersCountsAndValues = bagParam.split('.').map((letterCountAndValue: string) => {
        if (!letterCountAndValue.match(/^(.*)-(\d+)-(\d+)$/)) {
          throw new Error(`Invalid letter configuration in URL: ${letterCountAndValue}`)
        }
        const parts = letterCountAndValue.split('-')
        letterCounts[parts[0]!] = parseInt(parts[1]!)
        letterValues[parts[0]!] = parseInt(parts[2]!)
      })
      settings.letterCounts = letterCounts
      settings.letterValues = letterValues
    }
    const boardParam = gameParams.get('board')
    if (boardParam) settings.boardLayout = boardParam.split('-')
    const bingoParam = gameParams.get('bingo')
    if (bingoParam) settings.bingoBonus = parseInt(bingoParam)
    const racksizeParam = gameParams.get('racksize')
    if (racksizeParam) settings.rackCapacity = parseInt(racksizeParam)
    const tileSystemType: 'honor' = settings.tileSystemType
    const seedParam = gameParams.get('seed')
    if (!seedParam) throw new Error('No random seed in URL.')
    settings.tileSystemSettings = {seed: seedParam}
    const dtParam = gameParams.get('dt')
    if (dtParam === 'permissive' || dtParam === 'freeapi' || dtParam === 'custom') {
      settings.dictionaryType = dtParam
    } else if (dtParam) {
      throw new Error(`Unknown dictionary type: "${dtParam}".`)
    }
    const dsParam = gameParams.get('ds')
    if (dsParam) settings.dictionarySettings = dsParam
    else if (settings.dictionaryType === 'custom') {
      throw new Error('Custom dictionary requires a URL.')
    }
    if (!playerId) {
      const urlTurnNumber = parseInt(turnParams.get('tn')!) || 1
      const turnNumber = urlTurnNumber + turnParams.getAll('wl').length + turnParams.getAll('ex').length
      playerId = settings.players[(turnNumber - 1) % settings.players.length]!.id
      console.log(`Joining as Player ${playerId}.`)
    }
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
      history: this.history,
    }
  }

  static async fromJSON(json: any) {
    function fail(msg: string): never {
      throw new TypeError(`${msg} in GameState serialization: ${JSON.stringify(json)}`)
    }
    if (typeof json !== 'object') fail('Not an object')
    if (!arraysEqual(
      [...Object.keys(json)],
      ['shared', 'playerId', 'keepAllHistory', 'tilesHeld', 'history']
    )) {
      fail('Wrong keys or key order')
    }
    if (typeof json.playerId !== 'string') fail('Player ID is not a string')
    if (typeof json.keepAllHistory !== 'boolean') fail('keepAllHistory is not a boolean')
    if (!Array.isArray(json.tilesHeld)) fail('tilesHeld is not an array')
    if (!Array.isArray(json.history)) fail('History is not an array')

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
      if (typeof tileJson.col !== 'number') fail ('Invalid tilesHeld[].col')
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
    // TODO - Check json.history element types.

    const gameState = new GameState(
      json.playerId,
      undefined,  // settings
      json.keepAllHistory,
      SharedState.fromJSON(json.shared),
      tilesHeld,
      json.history,
    )
    await gameState.init()
    return gameState
  }
}

function playersEqual(ps1: ReadonlyArray<Player>, ps2: ReadonlyArray<Player>) {
  if (ps1.length !== ps2.length) return false
  for (const index in ps1) {
    if (!ps1[index]!.equals(ps2[index])) return false
  }
  return true
}
