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

import { arraysEqual } from './serializable.js'
import { Settings } from './settings.js'
import type { TilesState } from './tiles_state.js'
import { checkIndices } from './tiles_state.js'
import { Turn } from './turn.js'
import type { TurnNumber } from './turn.js'
import { HonorSystemTilesState } from './honor_system_tiles_state.js'
import { Board } from './board.ts'
import type { TilePlacement } from './tile.ts'

type GameId = string & { '__brand': 'GameId' }

export class SharedState {
  readonly playerIds: Array<string>

  constructor(
    readonly settings: Settings,
    readonly board: Board,
    readonly tilesState: TilesState,
    readonly gameId = `game-${Date.now()}` as GameId,
    public nextTurnNumber = 1 as TurnNumber,
  ) {
    this.playerIds = settings.players.map(p => p.id)
  }

  async playTurns(...turns: Array<Turn>) {
    const seen = []
    for (const turn of turns) {
      if (turn.turnNumber < this.nextTurnNumber) {
        console.log(`Ignoring old turn number ${turn.turnNumber}`)
      } else if (turn.turnNumber in seen) {
        throw new Error(`playTurns received duplicate turn number ${turn.turnNumber}.`)
      } else {
        seen[turn.turnNumber] = turn
      }
    }
    const turnsToPlayNow = [] as Array<Turn>
    for (const turn of seen.filter(t => t)) {
      if (turn.turnNumber !== this.nextTurnNumber) {
        // TODO: Remember the turn.
        console.warn(`Ignoring out-of-order turn number ${turn.turnNumber}; expected ${this.nextTurnNumber}.`)
        break
      }
      const playerId = this.playerIds[(this.nextTurnNumber - 1) % this.playerIds.length]
      if (turn.playerId !== playerId) {
        throw new Error(`Turn number ${turn.turnNumber} belongs to player "${playerId}", not "${turn.playerId}".`)
      }
      if ('playTiles' in turn.move) {
        const {score, wordsFormed} = this.board.checkWordPlacement(...turn.move.playTiles)
        if (this.settings.dictionaryType !== 'permissive') {
          throw new Error(`${this.settings.dictionaryType} dictionary is not yet supported.`)
        }
        this.board.placeTiles(...turn.move.playTiles)
        this.board.scores.set(playerId, (this.board.scores.get(playerId) ?? 0) + score)
        console.log(`Player ${playerId} played ${wordsFormed[0]} for ${score}`)
      } else if ('exchangeTileIndices' in turn.move) {
        checkIndices(turn.move.exchangeTileIndices, this.tilesState.countTiles(playerId))
        const numAttempted = turn.move.exchangeTileIndices.length
        const numInBag = this.tilesState.numberOfTilesInBag
        if (numAttempted > numInBag) {
          throw new Error(`Player ${playerId} attempted to exchange ${numAttempted} but the bag holds only ${numInBag}.`)
        }
        if (numAttempted) {
          console.log(`Player ${playerId} exchanged ${numAttempted} tiles.`)
        } else {
          console.log(`Player ${playerId} passed.`)
        }
      } else {
        throw new Error(`Turn number ${turn.turnNumber} is not a play or exchange.`)
      }
      turnsToPlayNow.push(turn)
      this.nextTurnNumber++
    }
    return this.tilesState.playTurns(...turnsToPlayNow)
  }

  toJSON() {
    return {
      gameId: this.gameId,
      nextTurnNumber: this.nextTurnNumber,
      settings: this.settings.toJSON(),
      board: this.board.toJSON(),
      tilesState: this.tilesState.toJSON(),
    }
  }

  static fromJSON(json: any) {
    function fail() {
      throw new TypeError(`Invalid SharedGameState serialization: ${JSON.stringify(json)}`)
    }
    if (typeof json !== 'object') fail()
    if (!arraysEqual([...Object.keys(json)], [
      'gameId', 'nextTurnNumber', 'settings', 'board', 'tilesState',
    ])) fail()
    if (typeof json.gameId !== 'string') fail()
    if (typeof json.nextTurnNumber !== 'number') fail()
    const settings = Settings.fromJSON(json.settings)
    return new SharedState(
      settings,
      Board.fromJSON(json.board),
      rehydrateTilesState(settings.tileSystemType, json.tilesState),
      json.gameId as GameId,
      json.nextTurnNumber as TurnNumber,
    )
  }
}

function rehydrateTilesState(tileSystemType: string, tilesStateJson: any) {
  if (tileSystemType === 'honor') return HonorSystemTilesState.fromJSON(tilesStateJson)
  throw new TypeError(`Unknown tileSystemType ${tileSystemType}`)
}
