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
      expect(params.toString()).toBe('v=0&seed=1')
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
      expect(params.get('bag')).toBe('Z--20..en')
    })

    test('bag with removed letter is abbreviated', () => {
      const settings = Settings.forLanguage('en')
      const letterCounts = new Map(settings.letterCounts)
      letterCounts.delete('A')
      settings.letterCounts = letterCounts
      const params = gameParamsFromSettings(settings)
      expect(params.get('bag')).toBe('A-0..en')
    })

    test('bag with removed blank is abbreviated', () => {
      const settings = Settings.forLanguage('en')
      const letterCounts = new Map(settings.letterCounts)
      letterCounts.delete('') // Remove blank tile
      settings.letterCounts = letterCounts
      const params = gameParamsFromSettings(settings)
      expect(params.get('bag')).toBe('_-0..en')
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
      expect(params.get('bag')).toBe('Ю-5-10..en')
    })
  })

  describe('parseGameParams', () => {
    test('default settings', () => {
      const params = new URLSearchParams('v=0&seed=1&tn=1')
      const { settings, playerId, turnParams } = parseGameParams(params)
      const defaultSettings = Settings.forLanguage('en')
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
      const params = new URLSearchParams('v=0&seed=1&dt=custom')
      expect(() => parseGameParams(params)).toThrow('Custom dictionary requires a URL.')
    })

    test('no seed', () => {
      const params = new URLSearchParams('v=0')
      expect(() => parseGameParams(params)).toThrow('No random seed in URL.')
    })

    test('invalid letter config', () => {
      const params = new URLSearchParams('v=0&seed=&bag=A1')
      expect(() => parseGameParams(params)).toThrow('Invalid letter configuration in URL: A1')
    })
  })

  describe('parseBagParam', () => {
    test('parses letter, count, and value', () => {
      const settings = Settings.forLanguage('en')
      parseBagParam(settings, 'A-15-3')
      expect(settings.letterCounts).toEqual(new Map([['A', 15]]))
      expect(settings.letterValues).toEqual(new Map([['A', 3]]))
    })

    test('parses bag with blank tile', () => {
      const settings = Settings.forLanguage('en')
      parseBagParam(settings, '_-1-0')
      expect(settings.letterCounts.get('')).toBe(1)
      expect(settings.letterValues.get('')).toBe(0)
    })

    test('parses bag with emoji tile', () => {
      const settings = Settings.forLanguage('en')
      parseBagParam(settings, '😂-1-5')
      expect(settings.letterCounts.get('😂')).toBe(1)
      expect(settings.letterValues.get('😂')).toBe(5)
    })

    test('uses default value', () => {
      const settings = Settings.forLanguage('en')
      const letterValues = new Map(settings.letterValues)
      letterValues.set('A', 1)
      settings.letterValues = letterValues
      parseBagParam(settings, 'A-15')
      expect(settings.letterCounts).toEqual(new Map([['A', 15]]))
      expect(settings.letterValues).toEqual(new Map([['A', 1]]))
    })

    test('uses default count', () => {
      const settings = Settings.forLanguage('en')
      const letterCounts = new Map(settings.letterCounts)
      letterCounts.set('A', 9)
      settings.letterCounts = letterCounts
      parseBagParam(settings, 'A--3')
      expect(settings.letterCounts).toEqual(new Map([['A', 9]]))
      expect(settings.letterValues).toEqual(new Map([['A', 3]]))
    })

    test('uses default count and value', () => {
      const settings = Settings.forLanguage('en')
      settings.letterCounts = new Map([['A', 9], ['B', 3]])
      settings.letterValues = new Map([['A', 1], ['B', 3]])
      parseBagParam(settings, 'A')
      expect(settings.letterCounts).toEqual(new Map([['A', 9]]))
      expect(settings.letterValues).toEqual(new Map([['A', 1]]))
    })

    test.skip('uses default remaining letters', () => {
      const settings = Settings.forLanguage('en')
      settings.letterCounts = new Map([['A', 9], ['B', 3], ['C', 2]])
      settings.letterValues = new Map([['A', 1], ['B', 3], ['C', 4]])
      parseBagParam(settings, 'B-2-4..en')
      expect(settings.letterCounts).toEqual(new Map([['A', 9], ['B', 2], ['C', 2]]))
      expect(settings.letterValues).toEqual(new Map([['A', 1], ['B', 4], ['C', 4]]))
    })

    test.skip('uses default all letters', () => {
      const settings = Settings.forLanguage('en')
      settings.letterCounts = new Map([['A', 9], ['B', 3]])
      settings.letterValues = new Map([['A', 1], ['B', 3]])
      parseBagParam(settings, '.en')
      expect(settings.letterCounts).toEqual(new Map([['A', 9], ['B', 3]]))
      expect(settings.letterValues).toEqual(new Map([['A', 1], ['B', 3]]))
    })
  })
})
