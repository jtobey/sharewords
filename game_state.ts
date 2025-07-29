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
import { Board } from './board.js'
import { arraysEqual, objectsEqual } from './serializable.js'
import { SharedState } from './shared_state.js'
import { Tile } from './tile.js'
import type { TilePlacement } from './tile.js'
import { Player } from './player.js'
import { Turn, nextTurnNumber } from './turn.js'
import type { TurnNumber } from './turn.js'

type TurnData = {turnNumber: TurnNumber, params: string}

class GameState {
  constructor(
    readonly playerId: string,  // The local player.
    readonly shared: SharedState,
    public keepAllHistory = false,
    public rack = [] as Array<Tile>,
    /**
     * The last N turns played by any player, where N is at least one less
     * than the number of players. Turn URLs should describe the last move
     * made by each player except the player whose turn it is.
     */
    readonly history = [] as Array<TurnData>,
  ) {
    if (!shared.settings.players.some(p => p.id === playerId)) {
      throw new Error(`Player ID "${playerId}" is not listed in settings.`)
    }
  }

  async updateRack() {
    this.rack = await this.shared.tilesState.getTiles(this.playerId)
    // TODO - Define and fire a rack-change event.
  }

  get settings()       { return this.shared.settings }
  get gameId()         { return this.shared.gameId }
  get nextTurnNumber() { return this.shared.nextTurnNumber }
  get players()        { return this.shared.players }
  get board()          { return this.shared.board }
  
  async playTurns(...turns: Array<Turn>) {
    // `this.shared.playTurns` validates several turn properties before it awaits.
    // For example:
    // * It rejects turns whose `playerId` does not line up with the order of play.
    // * It rejects invalid tile placement combinations.
    // * It updates the board and scores.
    // * It updates nextTurnNumber after each successfully processed turn.
    // It may or may not update tiles state (i.e., racks).
    let exception: any = null
    let promise: Promise<void> | null = null
    let iPlayed = false
    try { promise = this.shared.playTurns(...turns) }
    catch (e: any) { exception = e }

    // Update history. Try not to throw exceptions in this loop.
    let wroteHistory = false
    for (const turn of turns) {
      // Convert {playerId, turnNumber, move} to TurnData.
      if (turn.turnNumber as number >= this.nextTurnNumber) {
        // `this.shared.playTurns` must have returned early.
        break
      }
      if (this.history.length && turn.turnNumber as number <= (this.history[-1]!.turnNumber as number)) {
        continue
      }
      if (turn.playerId === this.playerId) iPlayed = true
      const params = new URLSearchParams
      if ('playTiles' in turn.move) {
        params.set('wl', `${turn.row}.${turn.col}`)
        const tileAssignments = [] as Array<string>
        turn.move.playTiles.forEach((placement: TilePlacement, index) => {
          if (placement.tile.isBlank) {
            tileAssignments.push(`${index}-${placement.assignedLetter}`)
          }
        })
        if (tileAssignments.length) params.set('bt', tileAssignments.join('.'))
        // Keep the word last so that it stands out in the URL.
        params.set(turn.vertical ? 'wv' : 'wh', turn.mainWord!)
      } else if ('exchangeTileIndices' in turn.move) {
        params.set('ex', turn.move.exchangeTileIndices.join('.'))
      }
      this.history.push({turnNumber: turn.turnNumber, params: String(params)})
      wroteHistory = true
    }
    if (wroteHistory) {
      // TODO - Define and fire a change event.
    }
    if (!this.keepAllHistory) {
      this.history.splice(0, this.history.length - this.players.length)
    }
    if (!promise) throw exception
    await promise
    if (iPlayed) await this.updateRack()
  }

  async applyTurnParams(params: URLSearchParams) {
    const urlTurnNumberStr = params.get('tn')
    if (!urlTurnNumberStr) {
      console.info('applyTurnParams: no turn number')
      return
    }
    const turns = [] as Array<Turn>
    let urlTurnNumber = parseInt(urlTurnNumberStr)
    let wordLocationStr: string | null = null
    let blankTileAssignmentsStr: string | null = null
    let direction: null | 'wv' | 'wh' = null
    let wordPlayed: string | null = null
    let exchangeIndicesStr: string | null = null
    const nextTurn = () => {
      const playerId = this.players[urlTurnNumber % this.players.length]!.id
      if (wordPlayed && direction && wordLocationStr) {
        if (exchangeIndicesStr) {
          throw new Error(`URL contains both word and exchange data for turn ${urlTurnNumber}`)
        }
        const blankTileAssignments = [] as Array<string>
        if (blankTileAssignmentsStr) {
          blankTileAssignmentsStr.split('.').forEach((s: string) => {
            const match = s.match(/^(\d+)-(.+)/)
            if (!match) { throw new Error(`Invalid "bt" URL parameter component: ${s}`) }
            const index = parseInt(match[1]!)
            if (index in blankTileAssignments) {
              throw new Error(`Duplicate blank tile assignment index: bt=${blankTileAssignmentsStr}`)
            }
            blankTileAssignments[index] = match[2]!
          })
        }
        const match = wordLocationStr.match(/^(\d+)\.(\d+)$/)
        if (!match) { throw new Error(`Invalid wl parameter in URL: ${wordLocationStr}`) }
        let row = parseInt(match[1]!)
        let col = parseInt(match[2]!)
        const placements = [] as Array<TilePlacement>
        for (const letter of wordPlayed.split('')) {
          const square = this.board.squares[row]?.[col]
          if (!square) { throw new RangeError(`Attemted to play a word out of bounds: ${row},${col}.`) }
          if (!square.tile) {
            // It must be a new tile from the player's rack.
            const assignedLetter = blankTileAssignments[placements.length] ?? ''
            const value = assignedLetter ? 0 : this.settings.letterValues[letter]
            if (value === undefined) { throw new Error(`Attempt to play an invalid letter: "${letter}"`) }
            placements.push({tile: new Tile({letter, value}), assignedLetter, row, col})
          } else if (square.letter !== letter) {
            throw new Error(`Attempt word requires "${letter}" at ${row},${col}, but "${square.letter}" is there.`)
          }
          if (direction === 'wv') { row += 1 }
          else { col += 1 }
        }
        if (blankTileAssignments.length > placements.length) {
          throw new RangeError(
            `"bt" URL parameter has index ${blankTileAssignments.length - 1} out of range 0-${placements.length - 1}`
          )
        }
        turns.push(new Turn(playerId, urlTurnNumber as TurnNumber, {playTiles: placements}))
      } else if (exchangeIndicesStr != null) {
        if (wordPlayed || direction || wordLocationStr || blankTileAssignmentsStr) {
          throw new Error(
            `Incomplete URL data for turn ${urlTurnNumber}: wl=${wordLocationStr} ${direction}=${wordPlayed} bt=${blankTileAssignmentsStr}`)
        }
        const exchangeIndexStrs = exchangeIndicesStr.split('.')
        const numberOfTilesInRack = this.shared.tilesState.countTiles(playerId)
        exchangeIndexStrs.forEach((s: string) => {
          let index: number
          try { index = parseInt(s) }
          catch (e: any) {
            throw new Error(`Invalid exchange tile index in URL: "${s}".`)
          }
          if (index < 0 || index >= numberOfTilesInRack) {
            throw new RangeError(`Exchange tile index ${index} in URL is out of range 0-${numberOfTilesInRack - 1}`)
          }
        })
        turns.push(new Turn(playerId, urlTurnNumber as TurnNumber, {exchangeTileIndices: exchangeIndexStrs.map(parseInt)}))
      } else {
        // Nothing to see here, don't bump the turn number.
        return
      }
      urlTurnNumber++
      wordLocationStr = null
      blankTileAssignmentsStr = null
      direction = null
      wordPlayed = null
      exchangeIndicesStr = null
    }
    for (const [key, value] of params) {
      if (key === 'wl') {
        nextTurn()
        wordLocationStr = value
      } else if (key === 'ex') {
        nextTurn()
        exchangeIndicesStr = value
      } else if (key === 'bt') {
        if (blankTileAssignmentsStr) {
          throw new Error(`Duplicate "bt" parameter in URL data for turn ${urlTurnNumber}`)
        }
        blankTileAssignmentsStr = value
      } else if (key === 'wv' || key === 'wh') {
        if (direction) {
          throw new Error(`Duplicate word parameters in URL data for turn ${urlTurnNumber}`)
        }
        direction = key
        wordPlayed = value
      }
    }
    nextTurn()
    await this.playTurns(...turns)
  }

  get turnUrlParams() {
    const gameParams = new URLSearchParams
    const turnHistory = this.history.slice(-this.players.length)
    const firstHistoryTurnNumber = turnHistory[0]?.turnNumber
    // Include game settings in the URL at the start of the game.
    if (firstHistoryTurnNumber === undefined || firstHistoryTurnNumber === 1 as TurnNumber) {
      this.toParams(gameParams)
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
      return gameParams
    }
  }

  toParams(params: URLSearchParams) {
    params.set('gid', this.gameId)
    if (this.nextTurnNumber <= this.settings.players.length) {
      // Not all players have played. Include any non-default game settings.
      const defaults = new Settings
      params.set('ver', this.settings.version)
      if (!playersEqual(this.settings.players, defaults.players)) {
        this.settings.players.forEach((p, index) => {
          params.append('pn', p.name)
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
          ([letter, count]) => `${letter}.${count}.${this.settings.letterValues[letter] ?? 0}`
        ).join('.')
        params.set('bag', bagParam)
      }
      if (this.settings.tileSystemType === 'honor') {
        params.set('seed', String(this.settings.tileSystemSettings))
      }
      if (this.settings.dictionaryType !== defaults.dictionaryType) {
        params.set('dt', this.settings.dictionaryType)
      }
      if (typeof this.settings.dictionarySettings === 'string') {
        params.set('ds', this.settings.dictionarySettings)
      }
    }
  }

  static async fromParams(params: Readonly<URLSearchParams>, playerId?: string) {
    const settings = new Settings
    const verParam = params.get('ver')
    if (verParam && verParam !== settings.version) {
      throw new Error(`Protocol version not supported: ${verParam}`)
    }
    const pnParams = params.getAll('pn')
    if (pnParams) settings.players = pnParams.map((name, index) => {
      const args = {id: String(index + 1), ...(name ? {name} : {})}
      return new Player(args)
    })
    const bagParam = params.get('bag')
    if (bagParam) {
      const letterCounts: {[key: string]: number} = {}
      const letterValues: {[key: string]: number} = {}
      const lettersCountsAndValues = bagParam.split('.').map((letterCountAndValue: string) => {
        const parts = letterCountAndValue.split('-')
        if (parts.length === 3) {
          letterCounts[parts[0]!] = parseInt(parts[1]!)
          letterValues[parts[0]!] = parseInt(parts[1]!)
        } else {
          // TODO
        }
      })
      settings.letterCounts = letterCounts
      settings.letterValues = letterValues
    }
    const boardParam = params.get('board')
    if (boardParam) settings.boardLayout = boardParam.split('-')
    const bingoParam = params.get('bingo')
    if (bingoParam) settings.bingoBonus = parseInt(bingoParam)
    const racksizeParam = params.get('racksize')
    if (racksizeParam) settings.rackCapacity = parseInt(racksizeParam)
    const tileSystemType: 'honor' = settings.tileSystemType
    if (tileSystemType === 'honor') {
      const seedParam = params.get('seed')
      if (!seedParam) throw new Error('No random seed in URL.')
      settings.tileSystemSettings = parseInt(seedParam)
    }
    const dictionaryType = params.get('dt')
    if (dictionaryType === 'permissive' || dictionaryType === 'freeapi' || dictionaryType === 'custom') {
      settings.dictionaryType = dictionaryType
    } else {
      throw new Error(`Unknown dictionary type: "${dictionaryType}".`)
    }
    const dictionarySettings = params.get('ds')
    if (dictionaryType === 'custom') {
      settings.dictionarySettings = dictionarySettings
    }
    if (!playerId) {
      if (settings.players.length === 2) {
        playerId = settings.players[1]!.id
        console.log(`Joining as player ${playerId}`)
      } else {
        throw new Error(`No player ID provided. Who am I?`)
      }
    }
    const gameState = new GameState(playerId, new SharedState(settings))
    await gameState.applyTurnParams(params)
    return gameState
  }

  toJSON() {
    return {
      shared: this.shared.toJSON(),
      playerId: this.playerId,
      keepAllHistory: this.keepAllHistory,
      rack: this.rack.map(t => t.toJSON()),
      history: this.history,
    }
  }

  static fromJSON(json: any) {
    function fail(msg: string): never {
      throw new TypeError(`${msg} in GameState serialization: ${JSON.stringify(json)}`)
    }
    if (typeof json !== 'object') fail('Not an object')
    if (!arraysEqual(
      [...Object.keys(json)],
      ['shared', 'playerId', 'keepAllHistory', 'rack', 'history'])
    ) {
      fail('Wrong keys or key order')
    }
    if (typeof json.playerId !== 'string') fail('Player ID is not a string')
    if (typeof json.keepAllHistory !== 'boolean') fail('keepAllHistory is not a boolean')
    if (!Array.isArray(json.rack)) fail('Rack is not an array')
    if (!Array.isArray(json.history)) fail('History is not an array')

    return new GameState(
      json.playerId,
      SharedState.fromJSON(json.shared),
      json.keepAllHistory,
      json.rack.map(Tile.fromJSON),
      json.history,
    )
  }
}

function playersEqual(ps1: ReadonlyArray<Player>, ps2: ReadonlyArray<Player>) {
  if (ps1.length !== ps2.length) return false
  for (const index in ps1) {
    if (!ps1[index]!.equals(ps2[index])) return false
  }
  return true
}
