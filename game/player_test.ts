import { expect, describe, it } from 'bun:test'
import { Player } from './player.js'

describe('player', () => {
  it('should use `Player {id}` as name by default', () => {
    expect(new Player({id: '100'}).name).toEqual('Player 100')
  })
  describe('json', () => {
    it('should serialize', () => {
      expect(new Player({id: '11', name: 'Joe'}).toJSON()).toEqual({id: '11', name: 'Joe'})
    })
    it('should deserialize', () => {
      expect(Player.fromJSON({id: '10', name: 'Joni'})).toEqual(new Player({id: '10', name: 'Joni'}))
    })
    it('should reject an invalid object', () => {
      expect(() => Player.fromJSON('frob')).toThrow(TypeError)
    })
    it('should reject a non-string id', () => {
      expect(() => Player.fromJSON({id: 13, name: 'Aidan'})).toThrow(TypeError)
    })
    it('should reject a non-string name', () => {
      expect(() => Player.fromJSON({id: '10', name: ['Jane']})).toThrow(TypeError)
    })
  })
})
