import { SHARED_STATE_VERSION } from './version.js'
import type { Serializable } from './serializable.js'
import { arraysEqual } from './serializable.js'
import { Settings } from './settings.js'
import type { TilesState } from './tiles_state.js'
import { Turn } from './turn.js'
import type { TurnNumber } from './turn.js'
import { HonorSystemTilesState } from './honor_system_tiles_state.js'
import { Board } from './board.ts'
import type { TilePlacement } from './board.ts'

type GameId = string & { '__brand': 'GameId' }

class SharedState implements Serializable {
  constructor(
    readonly settings: Settings,
    readonly board: Board,
    readonly tilesState: TilesState,
    readonly gameId = `game-${Date.now()}` as GameId,
    public nextTurnNumber = 1 as TurnNumber,
    readonly turnsInFlight = [] as Array<Turn>,
  ) {}

  toJSON() {
    return {
      version: SHARED_STATE_VERSION,
      gameId: this.gameId,
      nextTurnNumber: this.nextTurnNumber,
      settings: this.settings.toJSON(),
      board: this.board.toJSON(),
      tilesState: this.tilesState.toJSON(),
      turnsInFlight: this.turnsInFlight,
    }
  }

  async playWord({playerId, tilePlacements}: {playerId: string, tilePlacements: ReadonlyArray<TilePlacement>}) {
    console.log(`Player ${playerId} attempts to place tiles: ${tilePlacements}`)
    const {score, wordsFormed} = this.board.checkWordPlacement(...tilePlacements)
    // XXX
  }

  static fromJSON(json: any) {
    function fail() {
      throw new TypeError(`Invalid SharedGameState serialization: ${JSON.stringify(json)}`)
    }
    if (typeof json !== 'object') fail()
    if (json.version !== SHARED_STATE_VERSION) {
      throw new Error(`Unsupported software version: ${json.version}`)
    }
    if (!arraysEqual([...Object.keys(json)], [
      'version', 'gameId', 'turnNumber', 'settings', 'board', 'tilesState',
    ])) fail()
    if (typeof json.gameId !== 'string') fail()
    if (typeof json.turnNumber !== 'number') fail()
    if (!Array.isArray(json.turnsInFlight)) fail()
    const settings = Settings.fromJSON(json.settings)
    return new SharedState(
      settings,
      Board.fromJSON(json.board),
      rehydrateTilesState(settings.tileSystemType, json.tilesState),
      json.gameId as GameId,
      json.turnNumber as TurnNumber,
      json.turnsInFlight,
    )
  }
}

function rehydrateTilesState(tileSystemType: string, tilesStateJson: any) {
  if (tileSystemType === 'honor') return HonorSystemTilesState.fromJSON(tilesStateJson)
  throw new TypeError(`Unknown tileSystemType ${tileSystemType}`)
}
