/**
 * @file Conversion between `Settings` and URL params.
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
 

import { Settings, toGameId } from './settings.js'
import { getBagDefaults, getBagLanguages } from './bag_defaults.js'
import { Player } from './player.js'
import { arraysEqual } from './validation.js'
import { getPlayerForTurnNumber, toTurnNumber } from './turn.js'
import { t } from '../i18n.js'

export class UrlError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'UrlError'
  }
}

/** Returns a `bag` param value for `settings`. */
export function getBagParam(settings: Settings): string | undefined {
  let bagParam = [...settings.letterCounts.entries()].map(
    ([letter, count]) => `${letter}-${count}-${settings.letterValues.get(letter) ?? 0}`
  ).join('.');

  const boardSize = settings.boardLayout.reduce((acc, row) => acc + row.length, 0);
  const tileCount = Math.round(boardSize / (15 * 15) * 100);

  for (const { code: bagLanguage } of getBagLanguages()) {
    const defaults = getBagDefaults(bagLanguage, tileCount)!
    const settingsLetters = new Set(settings.letterCounts.keys());
    const defaultLetters = new Set(defaults.letterCounts.keys());
    const diffParts: string[] = [];

    // Letters in settings that are not in defaults
    for (const letter of settingsLetters) {
      if (!defaultLetters.has(letter)) {
        const count = settings.letterCounts.get(letter)!;
        const value = settings.letterValues.get(letter) ?? 0;
        diffParts.push(`${letter}-${count}-${value}`);
      }
    }

    // Letters in both, but with differences, and letters in defaults but not settings
    for (const letter of defaultLetters) {
      const settingsHasLetter = settingsLetters.has(letter);
      const count = settings.letterCounts.get(letter);
      const value = settings.letterValues.get(letter);
      const defaultCount = defaults.letterCounts.get(letter);
      const defaultValue = defaults.letterValues.get(letter);

      if (settingsHasLetter && count === defaultCount && value === defaultValue) {
        continue;
      }

      if (!settingsHasLetter) {
        diffParts.push(`${letter}-`);
        continue;
      }

      let part = letter;
      const countIsDefault = count === defaultCount;
      const valueIsDefault = value === defaultValue;
      if (!countIsDefault && !valueIsDefault) {
        part += `-${count}-${value}`;
      } else if (!countIsDefault) {
        part += `-${count}`;
      } else if (count !== 0) { // !valueIsDefault
        part += `--${value}`;
      }
      diffParts.push(part);
    }

    diffParts.sort();

    const abbreviatedBagParam = [bagLanguage, ...diffParts].join('.')

    if (abbreviatedBagParam.length < bagParam.length) {
      bagParam = abbreviatedBagParam
    }
  }
  return bagParam;
}

export function gameParamsFromSettings(settings: Settings): URLSearchParams {
  const params = new URLSearchParams
  // Not all players have played. Include any non-default game settings.
  const defaults = Settings.forLanguage('')
  params.set('v', settings.version)
  if (!playersEqual(settings.players, defaults.players)) {
    settings.players.forEach((p, index) => {
      params.set(`p${index + 1}n`, p.name)
    })
  }
  if (!arraysEqual(settings.boardLayout, defaults.boardLayout, false)) {
    params.set('board', settings.boardLayout.join('-'))
  }
  if (settings.bingoBonus !== defaults.bingoBonus) {
    params.set('bingo', String(settings.bingoBonus))
  }
  const bagParam = getBagParam(settings)
  if (bagParam) {
    params.set('bag', bagParam)
  }
  if (settings.rackCapacity !== defaults.rackCapacity) {
    params.set('racksize', String(settings.rackCapacity))
  }
  if (settings.tileSystemType === 'honor') {
    params.set('seed', settings.tileSystemSettings.seed)
  }
  if (settings.dictionaryType !== defaults.dictionaryType) {
    params.set('dt', settings.dictionaryType)
  }
  if (typeof settings.dictionarySettings === 'string') {
    params.set('ds', settings.dictionarySettings)
  }
  return params
}

export function parseBagParam(bagParam: string, boardLayout: string[]) {
  const boardSize = boardLayout.reduce((acc, row) => acc + row.length, 0);
  const tileCount = Math.round(boardSize / (15 * 15) * 100);
  const bagSettings = getBagDefaults('');
  const lettersSeen = new Set<string>;

  function mergeLetterConfig(letter: string, count?: number, value?: number) {
    if (count === undefined && value === undefined) {
      bagSettings.letterCounts.delete(letter);
      bagSettings.letterValues.delete(letter);
    } else {
      const oldCount = bagSettings.letterCounts.get(letter);
      const oldValue = bagSettings.letterValues.get(letter);
      bagSettings.letterCounts.set(letter, count ?? oldCount ?? 1);
      bagSettings.letterValues.set(letter, value ?? oldValue ?? 1);
    }
  }

  for (const config of bagParam.split('.')) {
    if (config.match(/^[a-z]/)) {
      const bagLanguage = config;
      const defaults = getBagDefaults(bagLanguage, tileCount);
      if (!defaults) {
        throw new UrlError(t('error.url.invalid_tile_distribution', { specifier: bagLanguage }));
      }
      defaults.letterCounts.entries().forEach(([letter, count]) => {
        mergeLetterConfig(letter, count, defaults.letterValues.get(letter));
      });
    } else {
      const match = config.match(/^(?<letter>.*?)(?:-(?<count>(?:\d+$|\d*))(?:-(?<value>\d+))?)?$/u);
      if (!match) {
        throw new Error(`Letter config pattern does not match "${config}".`);
      }
      const g = match.groups!
      const letter = g.letter!
      if (lettersSeen.has(letter)) {
        throw new UrlError(t('error.url.duplicate_letter_config', { letter }));
      }
      lettersSeen.add(letter);
      const count = (g.count === '' || g.count === undefined ? undefined : parseInt(g.count, 10));
      const value = (g.value === '' || g.value === undefined ? undefined : parseInt(g.value, 10));
      mergeLetterConfig(letter, count, value);
    }
  }
  return bagSettings;
}

/**
 * @throws UrlError
 */
export function parseGameParams(allParams: Readonly<URLSearchParams>) {
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
  const settings = Settings.forLanguage('')
  const vParam = gameParams.get('v')
  if (vParam && vParam !== settings.version) {
    throw new UrlError(t('error.url.protocol_not_supported', { version: vParam }))
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
  const boardParam = gameParams.get('board')
  if (boardParam) settings.boardLayout = boardParam.split('-')
  const bagParam = gameParams.get('bag')
  if (bagParam) {
    const parsed = parseBagParam(bagParam, settings.boardLayout)
    settings.letterCounts = parsed.letterCounts
    settings.letterValues = parsed.letterValues
  }
  const bingoParam = gameParams.get('bingo')
  if (bingoParam) settings.bingoBonus = parseInt(bingoParam, 10)
  const racksizeParam = gameParams.get('racksize')
  if (racksizeParam) settings.rackCapacity = parseInt(racksizeParam, 10)
  const seedParam = gameParams.get('seed')
  if (!seedParam) throw new UrlError(t('error.url.no_random_seed'))
  settings.tileSystemSettings = {seed: seedParam}
  const dtParam = gameParams.get('dt')
  if (dtParam === 'permissive' || dtParam === 'freeapi' || dtParam === 'wordlist') {
    settings.dictionaryType = dtParam
  } else if (dtParam) {
    // TODO(#95): Support 'consensus' type.
    throw new UrlError(t('error.url.unknown_dictionary_type', { type: dtParam }))
  }
  const dsParam = gameParams.get('ds')
  if (dsParam) settings.dictionarySettings = dsParam
  else if (settings.dictionaryType === 'wordlist') {
    throw new UrlError(t('error.url.custom_dictionary_requires_url'))
  }
  let playerId = gameParams.get('pid') ?? undefined
  if (!playerId) {
    const urlTurnNumber = parseInt(turnParams.get('tn')!, 10) || 1
    const turnNumber = toTurnNumber(urlTurnNumber + turnParams.getAll('wl').length + turnParams.getAll('ex').length)
    playerId = getPlayerForTurnNumber(settings.players, turnNumber).id
    console.log(`Joining as Player ${playerId}.`)
  }
  return { settings, playerId, turnParams }
}

function playersEqual(ps1: ReadonlyArray<Player>, ps2: ReadonlyArray<Player>) {
  if (ps1.length !== ps2.length) return false
  for (const index in ps1) {
    if (!ps1[index]!.equals(ps2[index])) return false
  }
  return true
}
