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
import { compile } from './compiler.js'
import { Lexicon } from './swdict.js'
import { WordList } from './word_list.js'

describe('word list', () => {
  it('should know what is a word', async () => {
    const words = ['blue', 'bluer', 'bluest', 'green', 'greener', 'greenery', 'greenest']
    const alphabet = [...new Set(words.join(''))]
    const name = 'Test Lexicon'
    const description = 'Lexicon for testing.'
    const clearInterval = 16
    const lexicon = await compile({ words, alphabet, name, description, clearInterval })
    const binary = Lexicon.encode(lexicon).finish()
    const wordList = new WordList(binary)
    expect(wordList.has('aqua')).toBeFalse()
    expect(wordList.has('blue')).toBeTrue()
    expect(wordList.has('blued')).toBeFalse()
    expect(wordList.has('bluer')).toBeTrue()
    expect(wordList.has('blues')).toBeFalse()
    expect(wordList.has('bluest')).toBeTrue()
    expect(wordList.has('fuchsia')).toBeFalse()
    expect(wordList.has('green')).toBeTrue()
    expect(wordList.has('greene')).toBeFalse()
    expect(wordList.has('greener')).toBeTrue()
    expect(wordList.has('greeners')).toBeFalse()
    expect(wordList.has('greenery')).toBeTrue()
    expect(wordList.has('greenes')).toBeFalse()
    expect(wordList.has('greenest')).toBeTrue()
    expect(wordList.has('indigo')).toBeFalse()
  })

  it('should follow a subroutine', () => {
    const name = 'Test Lexicon'
    const description = 'Lexicon for testing.'
    const lexicon = Lexicon.create({
      metadata: {
        name,
        description,
        macros: [
          { clear: true },                 // 0
          { subword: 'A' },                // 1 'A'
          { subword: 'B' },                // 2 'B'
          { subroutine: { instructions: [ 1, 2, 2, 1 ] } },  // 3 'ABBA'
        ],
      },
      instructions: [ 3 ],
    })
    const binary = Lexicon.encode(lexicon).finish()
    const wordList = new WordList(binary)
    expect([...wordList].map(String)).toEqual(['ABBA'])
  })

  it('should follow a nested subroutine', () => {
    const name = 'Test Lexicon'
    const description = 'Lexicon for testing.'
    const lexicon = Lexicon.create({
      metadata: {
        name,
        description,
        macros: [
          { clear: true },              // 0
          { subword: 'Z' },             // 1 'Z'
          { subword: 'Y' },             // 2 'Y'
          { subroutine: { instructions: [ 2, 2 ] } },     // 3 'YY'
          { subroutine: { instructions: [ 1, 3, 1 ] } },  // 4 'ZYYZ'
        ],
      },
      instructions: [ 4 ],
    })
    const binary = Lexicon.encode(lexicon).finish()
    const wordList = new WordList(binary)
    expect([...wordList].map(String)).toEqual(['ZYYZ'])
  })

  it('should reject a recursive subroutine', () => {
    const name = 'Test Lexicon'
    const description = 'Lexicon for testing.'
    const lexicon = Lexicon.create({
      metadata: {
        name,
        description,
        macros: [
          { clear: true },           // 0
          { subword: 'a' },          // 1
          { subroutine: { instructions: [ 1, 3 ] } },  // 2
          { subroutine: { instructions: [ 2, 1 ] } },  // 3
        ],
      },
      instructions: [ 3 ],
    })
    const binary = Lexicon.encode(lexicon).finish()
    expect(() => new WordList(binary)).toThrow()
  })
})
