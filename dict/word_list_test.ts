import { expect, describe, it } from 'bun:test'
import { compile } from './compiler.js'
import { Lexicon } from './dict.js'
import { WordList } from './word_list.js'

describe('word list', () => {
  it('should know what is a word', async () => {
    const words = ['blue', 'bluer', 'bluest', 'green', 'greener', 'greenest']
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
    expect(wordList.has('greenest')).toBeTrue()
    expect(wordList.has('indigo')).toBeFalse()
  })
})
