import { describe, test, expect } from 'bun:test'
import { gameParamsFromSettings, parseGameParams } from './game_params.js'
import { Settings } from './settings.js'
import { Player } from './player.js'

describe('game params', () => {
  describe('gameParamsFromSettings', () => {
    test('default settings', () => {
      const settings = new Settings()
      const params = gameParamsFromSettings(settings)
      expect(params.toString()).toBe('v=0&seed=1')
    })

    test('all settings', () => {
      const settings = new Settings()
      settings.players = [new Player({ id: '1', name: 'p1' }), new Player({ id: '2', name: 'p2' })]
      settings.boardLayout = ['_']
      settings.bingoBonus = 100
      settings.letterCounts = { 'A': 1 }
      settings.letterValues = { 'A': 2 }
      settings.rackCapacity = 8
      settings.tileSystemSettings.seed = 'foo'
      settings.dictionaryType = 'freeapi'
      settings.dictionarySettings = 'bar'
      const params = gameParamsFromSettings(settings)
      expect(params.toString()).toBe('v=0&p1n=p1&p2n=p2&board=_&bingo=100&bag=A-1-2&racksize=8&seed=foo&dt=freeapi&ds=bar')
    })
  })

  describe('parseGameParams', () => {
    test('default settings', async () => {
      const params = new URLSearchParams('v=0&seed=1&tn=1')
      const { settings, playerId, turnParams } = await parseGameParams(params)
      const defaultSettings = new Settings()
      defaultSettings.tileSystemSettings.seed = '1'
      expect(settings).toEqual(defaultSettings)
      expect(playerId).toBe('1')
      expect(turnParams.toString()).toBe('tn=1')
    })

    test('all settings', async () => {
      const params = new URLSearchParams('v=0&p1n=p1&p2n=p2&board=_&bingo=100&bag=A-1-2&racksize=8&seed=foo&dt=freeapi&ds=bar&pid=2&tn=3&wl=1.2&wh=WORD')
      const { settings, playerId, turnParams } = await parseGameParams(params)
      const expectedSettings = new Settings()
      expectedSettings.players = [new Player({ id: '1', name: 'p1' }), new Player({ id: '2', name: 'p2' })]
      expectedSettings.boardLayout = ['_']
      expectedSettings.bingoBonus = 100
      expectedSettings.letterCounts = { 'A': 1 }
      expectedSettings.letterValues = { 'A': 2 }
      expectedSettings.rackCapacity = 8
      expectedSettings.tileSystemSettings.seed = 'foo'
      expectedSettings.dictionaryType = 'freeapi'
      expectedSettings.dictionarySettings = 'bar'
      expect(settings).toEqual(expectedSettings)
      expect(playerId).toBe('2')
      expect(turnParams.toString()).toBe('tn=3&wl=1.2&wh=WORD')
    })

    test('unknown dictionary type', async () => {
      const params = new URLSearchParams('v=0&seed=1&dt=foo')
      await expect(parseGameParams(params)).rejects.toThrow('Unknown dictionary type: "foo".')
    })

    test('custom dictionary without url', async () => {
      const params = new URLSearchParams('v=0&seed=1&dt=custom')
      await expect(parseGameParams(params)).rejects.toThrow('Custom dictionary requires a URL.')
    })

    test('no seed', async () => {
      const params = new URLSearchParams('v=0')
      await expect(parseGameParams(params)).rejects.toThrow('No random seed in URL.')
    })

    test('invalid letter config', async () => {
      const params = new URLSearchParams('v=0&seed=&bag=A-1')
      await expect(parseGameParams(params)).rejects.toThrow('Invalid letter configuration in URL: A-1')
    })
  })
})
