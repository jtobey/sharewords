/**
 * @file What gets stored about a game in localStorage.
 */

import { Settings } from './settings.js'
import { Board } from './board.js'
import { arraysEqual, objectsEqual } from './serializable.js'
import { SharedState } from './shared_state.js'
import { Tile } from './tile.js'
import type { TilePlacement } from './tile.js'
import { Player } from './player.js'
import { Turn } from './turn.js'
import type { TurnNumber } from './turn.js'

type TurnData = {turnNumber: TurnNumber, params: string}

class GameState {
  constructor(
    readonly playerId: string,  // The local player.
    readonly shared: SharedState,
    public keepAllHistory = false,
    public rack = [] as Array<Tile>,
    readonly history = [] as Array<TurnData>,
  ) {
    if (!shared.settings.players.some(p => p.id === playerId)) {
      throw new Error(`Player ID "${playerId}" is not listed in settings.`)
    }
  }

  async updateRack() {
    this.rack = await this.shared.tilesState.getTiles(this.playerId)
    // TODO - Fire a state-change event.
  }

  get settings()       { return this.shared.settings }
  get gameId()         { return this.shared.gameId }
  get nextTurnNumber() { return this.shared.nextTurnNumber }
  get players()        { return this.shared.players }
  
  async playTurns(...turns: Array<Turn>) {
    // `this.shared.playTurns` validates several turn properties before it awaits.
    // For example:
    // * It rejects turns whose `playerId` does not line up with the order of play.
    // * It rejects invalid tile placement combinations.
    // * It updates the board and scores.
    // It may or may not update tiles state (i.e., racks).
    let exception: any = null
    let promise: Promise<void> | null = null
    let iPlayed = false
    try { promise = this.shared.playTurns(...turns) }
    catch (e: any) { exception = e }

    // Update history. Try not to throw exceptions in this loop.
    for (const turn of turns) {
      // Convert {playerId, turnNumber, move} to TurnData.
      if (turn.turnNumber as number >= this.nextTurnNumber) {
        // `this.shared.playTurns` must have returned early.
        break
      }
      if (turn.playerId === this.playerId) iPlayed = true
      const params = new URLSearchParams
      if ('playTiles' in turn.move) {
        params.set('wl', `${turn.row}.${turn.col}`)
        const tileAssignments = [] as Array<string>
        turn.move.playTiles.forEach((placement: TilePlacement) => {
          if (placement.tile.isBlank) {
            tileAssignments.push(placement.assignedLetter!)
          }
        })
        if (tileAssignments.length) params.set('bt', tileAssignments.join('.'))
        // Keep the word last so that it stands out in the URL.
        params.set(turn.vertical ? 'wv' : 'wh', turn.mainWord!)
      } else if ('exchangeTileIndices' in turn.move) {
        params.set('ex', turn.move.exchangeTileIndices.join('.'))
      }
      this.history.push({turnNumber: turn.turnNumber, params: String(params)})
    }
    if (!this.keepAllHistory) {
      this.history.splice(0, this.history.length - this.players.length)
    }
    if (!promise) throw exception
    await promise
    if (iPlayed) await this.updateRack()
  }

  applyTurnParams(params: URLSearchParams) {
    // TODO - Build TurnData objects from params.
    // TODO - Append unseen turn data to history.
    // TODO - Trim history to the last players.length-1 turns unless this.keepAllHistory.
    // TODO - Fire a state-change event.
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
      if (!objectsEqual(this.settings.letterCounts, defaults.letterCounts)) {
        // TODO
      }
      if (!objectsEqual(this.settings.letterValues, defaults.letterValues)) {
        // TODO
      }
      if (this.settings.tileSystemType !== defaults.tileSystemType) {
        // TODO
      }
      if (this.settings.tileSystemType === 'honor') {
        params.set('seed', String(this.settings.tileSystemSettings))
      }
      if (this.settings.dictionaryType !== defaults.dictionaryType) {
        // TODO
      }
    }
  }

  static fromParams(params: Readonly<URLSearchParams>, playerId?: string) {
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
    // TODO - Tile distribution and letter values.
    const boardParam = params.get('board')
    if (boardParam) settings.boardLayout = boardParam.split('-')
    const bingoParam = params.get('bingo')
    if (bingoParam) settings.bingoBonus = parseInt(bingoParam)
    // TODO - Rack capacity.
    const tileSystemType: 'honor' = settings.tileSystemType
    if (tileSystemType === 'honor') {
      const seedParam = params.get('seed')
      if (!seedParam) throw new Error('No random seed in URL.')
      settings.tileSystemSettings = parseInt(seedParam)
    }
    const dictionaryType = params.get('dt') || settings.dictionaryType
    if (dictionaryType === 'permissive') {
      // No dictionary settings - anything is a word.
    } else {
      throw new Error(`Dictionary type unimplemented: ${dictionaryType}`)
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
    gameState.applyTurnParams(params)
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
