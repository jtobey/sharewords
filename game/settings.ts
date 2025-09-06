/**
 * @file Settings for starting new games.
 */
/*
Copyright 2025 Google LLC

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    https://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/
 

import type { Serializable } from './serializable.js'
import { arraysEqual } from './validation.js'
import { getBagDefaults, type BagDefaults } from './bag_defaults.js'
import { Player } from './player.js'
import { PROTOCOL_VERSION } from './version.js'
import type { DictionaryType } from './dictionary.js'

export type GameId = string & { '__brand': 'GameId' }

export function toGameId(gameIdStr: string) {
  return gameIdStr as GameId
}

export function fromGameId(gameId: GameId) {
  return gameId as string
}

export function makeGameId(
  now = Date.now()
) {
  const ALPHABET = '123456789BCDFGHJKLMNPQRSTVWXYZbcdfghjkmnpqrstvwxyz'
  const base = BigInt(ALPHABET.length)
  let n = BigInt(Math.floor(now))
  let id = ''
  while (id.length < 7) {
    id = ALPHABET[Number(n % base)]! + id
    n /= base
  }
  return toGameId(id)
}

export let DEFAULT_BOARD_LAYOUT = [
  'D..d..T......T.', // Row 0
  '.D...D...t.t..T', // Row 1
  '..D.....t...t..',
  'd..D...t.....t.',
  '....D.t...D....',
  '.D...t.d.....t.',
  'T...d...d...t..',
  '...d.t...d.t...',
  '..d...t...t...T',
  '.d.....t.d...D.',
  '....D...d.D....',
  '.d.....d...D..d',
  '..d...d.....D..',
  'T..d.d...D...D.',
  '.T......T..d..D', // Row 14
]

export let DEFAULT_BINGO_BONUS = 42
export let DEFAULT_RACK_CAPACITY = 7

export class Settings {
  gameId: GameId | undefined  // Not serialized with Settings.
  baseUrl = 'http://nonet/'  // Not serialized with Settings.
  version = PROTOCOL_VERSION
  players = ['1', '2'].map(id => new Player({id}))
  maxPlayerNameLength = 50
  boardLayout = [...DEFAULT_BOARD_LAYOUT]
  bingoBonus = DEFAULT_BINGO_BONUS
  rackCapacity = DEFAULT_RACK_CAPACITY
  tileSystemType = 'honor' as 'honor'
  tileSystemSettings = {seed: '1'}
  dictionaryType: DictionaryType = 'permissive'
  dictionarySettings = null as Serializable

  private constructor(
    bagDefaults: BagDefaults,
    public letterCounts = bagDefaults.letterCounts,
    public letterValues = bagDefaults.letterValues,
  ) {}

  static forLanguage(bagLanguage: string): Settings | null;
  static forLanguage(bagLanguage: ''): Settings;
  static forLanguage(bagLanguage: 'en'): Settings;

  static forLanguage(bagLanguage: string) {
    const boardSize = DEFAULT_BOARD_LAYOUT.reduce((acc, row) => acc + row.length, 0);
    const tileCount = Math.round(boardSize / (15 * 15) * 100);
    const defaults = getBagDefaults(bagLanguage, tileCount)
    return defaults && new Settings(defaults)
  }

  toJSON() {
    return {
      version: this.version,
      players: this.players.map(p => p.toJSON()),
      letterCounts: mapToJSON(this.letterCounts),
      letterValues: mapToJSON(this.letterValues),
      boardLayout: this.boardLayout,
      bingoBonus: this.bingoBonus,
      rackCapacity: this.rackCapacity,
      tileSystemType: this.tileSystemType,
      tileSystemSettings: this.tileSystemSettings,
      dictionaryType: this.dictionaryType,
      dictionarySettings: this.dictionarySettings,
    }
  }

  static fromJSON(json: any) {
    function fail(msg: string): never {
      throw new TypeError(`${msg} in Settings serialization: ${JSON.stringify(json)}`);
    }
    if (typeof json !== 'object') fail('Not an object');
    if (!arraysEqual([...Object.keys(json)], [
      'version', 'players', 'letterCounts', 'letterValues', 'boardLayout',
      'bingoBonus', 'rackCapacity', 'tileSystemType', 'tileSystemSettings',
      'dictionaryType', 'dictionarySettings',
    ])) fail('Wrong keys or key order');
    if (json.version !== PROTOCOL_VERSION) fail(`Unsupported protocol version "${json.version}"`);
    if (!Array.isArray(json.players)) fail('`players` is not an array');
    if (!Array.isArray(json.boardLayout)) fail('`boardLayout` is not an array');
    if (!json.boardLayout.every((s: any) => typeof s === 'string')) fail('`boardLayout` contains a non-string');
    if (typeof json.bingoBonus !== 'number') fail('`bingoBonus` is not a number');
    if (typeof json.rackCapacity !== 'number') fail('`rackCapacity` is not a number');
    if (json.tileSystemType !== 'honor') fail(`Unsupported tile system type "${json.tileSystemType}"`);
    if (typeof json.tileSystemSettings !== 'object') fail('`tileSystemSettings` is not an object');
    if (json.tileSystemSettings === null) fail('`tileSystemSettings` is null');
    if (typeof json.tileSystemSettings.seed !== 'string') fail('`tileSystemSettings.seed` is not a string');
    if (!['permissive', 'consensus', 'wordlist', 'freeapi'].includes(json.dictionaryType)) {
      fail(`Unsupported dictionary type "${json.dictionaryType}"`);
    }
    const settings = Settings.forLanguage('')
    settings.version = json.version
    settings.players = json.players.map(Player.fromJSON)
    settings.letterCounts = checkLetterToNumberMap('letterCounts', json.letterCounts)
    settings.letterValues = checkLetterToNumberMap('letterValues', json.letterValues)
    settings.boardLayout = json.boardLayout
    settings.bingoBonus = json.bingoBonus
    settings.rackCapacity = json.rackCapacity
    settings.tileSystemType = json.tileSystemType
    settings.tileSystemSettings = json.tileSystemSettings
    settings.dictionaryType = json.dictionaryType
    settings.dictionarySettings = json.dictionarySettings
    return settings
  }
}

function checkLetterToNumberMap(name: string, json: any): Map<string, number> {
  function fail(msg: string): never {
    throw new TypeError(`Invalid Settings.${name} serialization: ${msg}`)
  }
  if (!Array.isArray(json)) {
    if (typeof json !== 'object') fail(`Type is "${typeof json}", not "object" as expected.`)
    // Compatibility with peoples' localStorage.
    json = [...Object.entries(json)]
  }
  json.forEach(([k, v]: any) => {
    if (typeof k !== 'string') fail(`Letter ${k} has type "${typeof k}", not "string" as expected.`)
    if (typeof v !== 'number') fail(`Letter ${k} has value ${v}, not a number as expected.`)
  })
  return new Map(json)
}

function mapToJSON(map: ReadonlyMap<string, number> | object) {
  // TODO - Remove this object-compatibility code.
  if (!(map instanceof Map)) return Object.entries(map)
  return [...map.entries()]
}
