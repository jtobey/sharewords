/**
 * @file Game state shared by all players.
 * @description
 * This logically includes:
 *
 * - game settings
 *   - protocol version
 *   - board dimensions
 *   - bonus square types and positions
 *   - tile manager configuration
 *   - bingo bonus value
 *   - letter and blank distribution
 *   - letter values
 *   - rack size
 *   - optional dictionary
 *   - player IDs, names, and turn order
 * - game ID
 * - shared tile state
 * - number of turns played
 * - tiles played on the board
 * - letter assignments to blank tiles played
 * - number of tiles in the bag
 * - each player's shared state
 *   - number of tiles on rack
 *   - score
 *
 * With the honor system, "shared tile state" contains the identities of all
 * tiles in the bag and on each player's rack. A secure tile manager configured
 * with a deck server URL could instead use an opaque identifier as the shared
 * tile state.
 */

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

class SharedState {
  readonly turnsInFlight: Array<Turn>
  constructor(
    readonly settings: Settings,
    readonly board: Board,
    readonly tilesState: TilesState,
    readonly gameId = `game-${Date.now()}` as GameId,
    public nextTurnNumber = 1 as TurnNumber,
    turnsInFlight = [] as Array<Turn>,
  ) {
    this.turnsInFlight = []
    for (const turn of turnsInFlight) {
      if (turn.turnNumber >= nextTurnNumber) {
        throw new RangeError(`turnsInFlight contains a turnNumber ${turn.turnNumber}, which is not less than nextTurnNumber.`)
      }
      if (turn.turnNumber in this.turnsInFlight) {
        throw new Error(`Duplicate turn number ${turn.turnNumber} in turnsInFlight.`)
      }
      this.turnsInFlight[turn.turnNumber] = turn
    }
  }

  toJSON() {
    return {
      gameId: this.gameId,
      nextTurnNumber: this.nextTurnNumber,
      settings: this.settings.toJSON(),
      board: this.board.toJSON(),
      tilesState: this.tilesState.toJSON(),
      turnsInFlight: Object.values(this.turnsInFlight),
    }
  }

  async playTurns(...turns: Array<Turn>) {
    const seen = new Set<number>
    for (const turn of turns) {
      if (turn.turnNumber < this.nextTurnNumber) {
        console.log(`Ignoring old turn number ${turn.turnNumber}`)
      } else if (turn.turnNumber in seen) {
        throw new Error(`playTurns received duplicate turn number ${turn.turnNumber}`)
      } else {
        seen.add(turn.turnNumber)
      }
    }
    // XXX
  }

  static fromJSON(json: any) {
    function fail() {
      throw new TypeError(`Invalid SharedGameState serialization: ${JSON.stringify(json)}`)
    }
    if (typeof json !== 'object') fail()
    if (!arraysEqual([...Object.keys(json)], [
      'gameId', 'turnNumber', 'settings', 'board', 'tilesState',
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
