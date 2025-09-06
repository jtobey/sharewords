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
import { describe, test, expect, beforeAll } from 'bun:test'
import { gameParamsFromSettings, parseGameParams, parseBagParam } from './game_params.js'
import { Settings } from './settings.js'
import { loadTranslations } from '../i18n.js'
import { Player } from './player.js'

describe('game params', () => {
  beforeAll(async () => {
    await loadTranslations('en')
  })

  describe('gameParamsFromSettings', () => {
    test('default settings', () => {
      const settings = Settings.forLanguage('en')
      const params = gameParamsFromSettings(settings)
      expect(params.toString()).toBe('v=0&bag=en&seed=1')
    })

    test('all settings', () => {
      const settings = Settings.forLanguage('en')
      settings.players = [new Player({ id: '1', name: 'p1' }), new Player({ id: '2', name: 'p2' })]
      settings.boardLayout = ['_']
      settings.bingoBonus = 100
      settings.letterCounts = new Map([['A', 1]])
      settings.letterValues = new Map([['A', 2]])
      settings.rackCapacity = 8
      settings.tileSystemSettings.seed = 'foo'
      settings.dictionaryType = 'freeapi'
      settings.dictionarySettings = 'bar'
      const params = gameParamsFromSettings(settings)
      expect(params.toString()).toBe('v=0&p1n=p1&p2n=p2&board=_&bingo=100&bag=A-1-2&racksize=8&seed=foo&dt=freeapi&ds=bar')
    })

    test('abbreviated bag param', () => {
      const settings = Settings.forLanguage('en')
      const letterValues = new Map(settings.letterValues)
      letterValues.set('Z', 20)
      settings.letterValues = letterValues
      const params = gameParamsFromSettings(settings)
      expect(params.get('bag')).toBe('en.Z--20')
    })

    test('bag with removed letter is abbreviated', () => {
      const settings = Settings.forLanguage('en')
      const letterCounts = new Map(settings.letterCounts)
      letterCounts.delete('A')
      settings.letterCounts = letterCounts
      const params = gameParamsFromSettings(settings)
      expect(params.get('bag')).toBe('en.A-')
    })

    test('bag with removed blank is abbreviated', () => {
      const settings = Settings.forLanguage('en')
      const letterCounts = new Map(settings.letterCounts)
      letterCounts.delete('') // Remove blank tile
      settings.letterCounts = letterCounts
      const params = gameParamsFromSettings(settings)
      expect(params.get('bag')).toBe('en.-')
    })

    test('bag with extended alphabet is abbreviated', () => {
      const settings = Settings.forLanguage('en')
      const letterCounts = new Map(settings.letterCounts)
      letterCounts.set('Ю', 5)
      settings.letterCounts = letterCounts
      const letterValues = new Map(settings.letterValues)
      letterValues.set('Ю', 10)
      settings.letterValues = letterValues
      const params = gameParamsFromSettings(settings)
      expect(params.get('bag')).toBe('en.Ю-5-10')
    })
  })

  describe('parseGameParams', () => {
    test('default settings', () => {
      const params = new URLSearchParams('v=0&seed=1&tn=1')
      const { settings, playerId, turnParams } = parseGameParams(params)
      const defaultSettings = Settings.forLanguage('')
      defaultSettings.tileSystemSettings.seed = '1'
      expect(settings).toEqual(defaultSettings)
      expect(playerId).toBe('1')
      expect(turnParams.toString()).toBe('tn=1')
    })

    test('all settings', () => {
      const params = new URLSearchParams('v=0&p1n=p1&p2n=p2&board=_&bingo=100&bag=A-1-2&racksize=8&seed=foo&dt=freeapi&ds=bar&pid=2&tn=3&wl=1.2&wh=WORD')
      const { settings, playerId, turnParams } = parseGameParams(params)
      const expectedSettings = Settings.forLanguage('en')
      expectedSettings.players = [new Player({ id: '1', name: 'p1' }), new Player({ id: '2', name: 'p2' })]
      expectedSettings.boardLayout = ['_']
      expectedSettings.bingoBonus = 100
      expectedSettings.letterCounts = new Map([['A', 1]])
      expectedSettings.letterValues = new Map([['A', 2]])
      expectedSettings.rackCapacity = 8
      expectedSettings.tileSystemSettings.seed = 'foo'
      expectedSettings.dictionaryType = 'freeapi'
      expectedSettings.dictionarySettings = 'bar'
      expect(settings).toEqual(expectedSettings)
      expect(playerId).toBe('2')
      expect(turnParams.toString()).toBe('tn=3&wl=1.2&wh=WORD')
    })

    test('unknown dictionary type', () => {
      const params = new URLSearchParams('v=0&seed=1&dt=foo')
      expect(() => parseGameParams(params)).toThrow('Unknown dictionary type: "foo".')
    })

    test('custom dictionary without url', () => {
      const params = new URLSearchParams('v=0&seed=1&dt=wordlist')
      expect(() => parseGameParams(params)).toThrow('Custom dictionary requires a URL.')
    })

    test('no seed', () => {
      const params = new URLSearchParams('v=0')
      expect(() => parseGameParams(params)).toThrow('No random seed in URL.')
    })
  })

  describe('parseBagParam', () => {
    const boardLayout = Settings.forLanguage('en').boardLayout

    test('parses letter, count, and value', () => {
      const parsed = parseBagParam('A-15-3', [])
      expect(parsed.letterCounts).toEqual(new Map([['A', 15]]))
      expect(parsed.letterValues).toEqual(new Map([['A', 3]]))
    })

    test('parses bag with blank tile', () => {
      const parsed = parseBagParam('-1-0', [])
      expect(parsed.letterCounts.get('')).toBe(1)
      expect(parsed.letterValues.get('')).toBe(0)
    })

    test('parses bag with emoji tile', () => {
      const parsed = parseBagParam('😂-1-5', [])
      expect(parsed.letterCounts.get('😂')).toBe(1)
      expect(parsed.letterValues.get('😂')).toBe(5)
    })

    test('uses default value', () => {
      const parsed = parseBagParam('en.A-15', boardLayout)
      expect(parsed.letterCounts.get('A')).toEqual(15)
      expect(parsed.letterValues.get('A')).toEqual(Settings.forLanguage('en').letterValues.get('A')!)
    })
    test('uses default count', () => {
      const parsed = parseBagParam('en.A--3', boardLayout)
      expect(parsed.letterCounts.get('A')).toEqual(Settings.forLanguage('en').letterCounts.get('A')!)
      expect(parsed.letterValues.get('A')).toEqual(3)
    })

    test('uses default remaining letters', () => {
      const parsed = parseBagParam('en.B-2-4', boardLayout)
      const settings = Settings.forLanguage('en')
      settings.letterCounts.set('B', 2)
      settings.letterValues.set('B', 4)
      expect(parsed.letterCounts).toEqual(settings.letterCounts)
      expect(parsed.letterValues).toEqual(settings.letterValues)
    })

    test('uses default all letters', () => {
      const parsed = parseBagParam('en', boardLayout)
      const settings = Settings.forLanguage('en')
      expect(parsed.letterCounts).toEqual(settings.letterCounts)
      expect(parsed.letterValues).toEqual(settings.letterValues)
    })
  })
})
