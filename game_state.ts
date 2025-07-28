/**
 * @file What gets stored about a game in localStorage.
 */

import { Settings } from './settings.js'
import { Board } from './board.js'
import { arraysEqual } from './serializable.js'
import { SharedState } from './shared_state.js'
import { Tile } from './tile.js'
import { Player } from './player.js'

type TurnData = string

class GameState {
  constructor(
    readonly playerId: string,
    readonly shared: SharedState,
    public rack = [] as Array<Tile>,
    readonly history = [] as Array<TurnData>,
  ) {
    if (!shared.settings.players.some(p => p.id === playerId)) {
      throw new Error(`Player ID "${playerId}" is not listed in settings.`)
    }
  }

  async updateRack() {
    this.rack = await this.shared.tilesState.getTiles(this.playerId)
  }

  get settings()       { return this.shared.settings }
  get gameId()         { return this.shared.gameId }
  get nextTurnNumber() { return this.shared.nextTurnNumber }
  get players()        { return this.shared.players }

  applyTurnParams(params: URLSearchParams) {
    // TODO
  }

  toParams(params: URLSearchParams) {
    params.set('gameId', this.gameId)
    if (this.nextTurnNumber <= this.players.length) {
      // Not all players have played. Include non-default game settings.
      const defaults = new Settings
      params.set('ver', this.settings.version)
      if (!playersEqual(this.players, defaults.players)) {
        for (const p of this.players) {
          params.set('pid', p.id)
          if (p.name) params.set('pn', p.name)
        }
      }
      // TODO - Finish.
    }
    // TODO - Add turn params.
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
      rack: this.rack.map(t => t.toJSON()),
      history: this.history,
    }
  }

  static fromJSON(json: any) {
    function fail(msg: string) {
      throw new TypeError(`${msg} in GameState serialization: ${JSON.stringify(json)}`)
    }
    if (typeof json !== 'object') fail('Not an object')
    if (!arraysEqual(
      [...Object.keys(json)],
      ['shared', 'playerId', 'rack', 'history'])
    ) {
      fail('Wrong keys or key order')
    }
    if (typeof json.playerId !== 'string') fail('Player ID is not a string')
    if (!Array.isArray(json.rack)) fail('Rack is not an array')
    if (!Array.isArray(json.history)) fail('History is not an array')

    return new GameState(
      json.playerId,
      SharedState.fromJSON(json.shared),
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
