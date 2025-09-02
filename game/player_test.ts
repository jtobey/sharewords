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
