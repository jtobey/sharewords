/**
 * @file Settings for starting new games.
 */

import type { Serializable, Stringifiable } from './serializable.js'
import { Player } from './player.js'

const DEFAULT_PLAYER_LIST = [
  new Player({id: '1'}),
  new Player({id: '2'}),
] as ReadonlyArray<Player>

const DEFAULT_LETTER_COUNTS = {
  'A': 9, 'B': 2, 'C': 2, 'D': 4, 'E': 12, 'F': 2, 'G': 2, 'H': 2, 'I': 9, 'J': 1,
  'K': 1, 'L': 4, 'M': 2, 'N': 6, 'O': 8, 'P': 2, 'Q': 1, 'R': 6, 'S': 5, 'T': 6,
  'U': 4, 'V': 2, 'W': 2, 'X': 1, 'Y': 2, 'Z': 1, '': 2
} as Readonly<{[key: string]: number}>

const DEFAULT_LETTER_VALUES = {
  'A': 1, 'B': 3, 'C': 4, 'D': 2, 'E': 1, 'F': 4, 'G': 3, 'H': 4, 'I': 1, 'J': 9,
  'K': 5, 'L': 1, 'M': 3, 'N': 1, 'O': 1, 'P': 3, 'Q': 10, 'R': 1, 'S': 1, 'T': 1,
  'U': 2, 'V': 5, 'W': 4, 'X': 8, 'Y': 4, 'Z': 10 // Z is 10 points
} as Readonly<{[key: string]: number}>

const DEFAULT_BOARD_LAYOUT = [
  'D..d..T......T.', // Row 0
  '.D...D...t.t..T', // Row 1
  '..D.....t...t..',
  'd..D...t.....t.',
  '....D.t...D....',
  '.D...d.d.....t.',
  'T...d...d...t..',
  '...d.t...d.t...',
  '..d...t...t...T',
  '.d.....t.t...D.',
  '....D...d.D....',
  '.d.....d...D..d',
  '..d...d.....D..',
  'T..d.d...D...D.',
  '.T......T..d..D', // Row 14
] as ReadonlyArray<string>

const DEFAULT_BINGO_BONUS = 42
const DEFAULT_RACK_CAPACITY = 7

class Settings implements Serializable {
  players = DEFAULT_PLAYER_LIST
  letterCounts = DEFAULT_LETTER_COUNTS
  letterValues = DEFAULT_LETTER_VALUES
  boardLayout = DEFAULT_BOARD_LAYOUT
  bingoBonus = DEFAULT_BINGO_BONUS
  rackCapacity = DEFAULT_RACK_CAPACITY
  tileSystemType = 'honor'
  tileSystemSettings = 1 as Stringifiable
  dictionaryType = 'permissive' as 'permissive' | 'freeapi' | 'custom'
  dictionarySettings = null as Stringifiable

  toJSON() {
    return {
      players: this.players.map(p => p.toJSON()),
      letterCounts: this.letterCounts,
      letterValues: this.letterValues,
      boardLayout: this.boardLayout,
      bingoBonus: this.bingoBonus,
      rackCapacity: this.rackCapacity,
      tileSystemType: this.tileSystemType,
      tileSystemSettings: this.tileSystemSettings,
      dictionaryType: this.dictionaryType,
      dictionarySettings: this.dictionarySettings,
    }
  }
}
