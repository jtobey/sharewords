import { expect, describe, it } from 'bun:test'
import { compile } from './compiler.js'
import { Lexicon } from './dict.js'
import { WordList } from './word_list.js'

describe('compiler', () => {
  it('should compile a lexicon', () => {
    const words = ['green', 'peas', 'the', 'three']
    const alphabet = [...'aeghnprst']
    const SUBWORD = {
      a: 1,
      e: 2,
      g: 3,
      h: 4,
      n: 5,
      p: 6,
      r: 7,
      s: 8,
      t: 9,
    }
    const BACKUP0 = 1 + alphabet.length
    const name = 'Test Lexicon'
    const description = 'Lexicon for testing.'
    const expected = Lexicon.fromJSON(Lexicon.toJSON(Lexicon.create({
      metadata: {
        name,
        description,
        clearInterval: 1024,
        macros: [
          { clear: true },
          { subword: 'a' },
          { subword: 'e' },
          { subword: 'g' },
          { subword: 'h' },
          { subword: 'n' },
          { subword: 'p' },
          { subword: 'r' },
          { subword: 's' },
          { subword: 't' },
          { backup: 0 },
          { backup: 1 },
          { backup: 2 },
          { backup: 3 },
          { backup: 4 },
          { backup: 5 },
        ],
      },
      instructions: [
        SUBWORD.g!,   // "g"
        SUBWORD.r!,   // "gr"
        SUBWORD.e!,   // "gre"
        SUBWORD.e!,   // "gree"
        SUBWORD.n!,   // "green"
        BACKUP0 + 5,  // ""
        SUBWORD.p!,   // "p"
        SUBWORD.e!,   // "pe"
        SUBWORD.a!,   // "pea"
        SUBWORD.s!,   // "peas"
        BACKUP0 + 4,  // ""
        SUBWORD.t!,   // "t"
        SUBWORD.h!,   // "th"
        SUBWORD.e!,   // "the"
        BACKUP0 + 1,  // "th"
        SUBWORD.r!,   // "thr"
        SUBWORD.e!,   // "thre"
        SUBWORD.e!,   // "three"
      ],
    })))
    const actual = Lexicon.fromJSON(Lexicon.toJSON(
      compile({ words, alphabet, name, description })
    ))
    expect(actual).toEqual(expected)
  })

  it('should clear the word buffer at intervals', () => {
    const words = ['eager', 'green', 'greener', 'greenest', 'groan', 'groaner']
    const alphabet = [...'aegnorst']
    const SUBWORD = {a: 1, e: 2, g: 3, n: 4, o: 5, r: 6, s: 7, t: 8}
    const BACKUP0 = 1 + alphabet.length
    const name = 'Test Lexicon'
    const description = 'Lexicon for testing.'
    const clearInterval = 11
    const expected = Lexicon.fromJSON(Lexicon.toJSON(Lexicon.create({
      metadata: {
        name,
        description,
        clearInterval,
        macros: [
          { clear: true },
          ...alphabet.map(subword => ({subword})),
          { backup: 0 },
          { backup: 1 },
          { backup: 2 },
          { backup: 3 },
          { backup: 4 },
          { backup: 5 },
        ],
      },
      instructions: [
        SUBWORD.e!,   // "e"
        SUBWORD.a!,   // "ea"
        SUBWORD.g!,   // "eag"
        SUBWORD.e!,   // "eage"
        SUBWORD.r!,   // "eager"
        BACKUP0 + 5,  // ""
        SUBWORD.g!,   // "g"
        SUBWORD.r!,   // "gr"
        SUBWORD.e!,   // "gre"
        SUBWORD.e!,   // "gree"
        SUBWORD.n!,   // "green"
        0,            // ""
        SUBWORD.g!,   // "g"
        SUBWORD.r!,   // "gr"
        SUBWORD.e!,   // "gre"
        SUBWORD.e!,   // "gree"
        SUBWORD.n!,   // "green"
        SUBWORD.e!,   // "greene"
        SUBWORD.r!,   // "greener"
        BACKUP0 + 1,  // "greene"
        SUBWORD.s!,   // "greenes"
        SUBWORD.t!,   // "greenest"
        0,            // ""
        SUBWORD.g!,   // "g"
        SUBWORD.r!,   // "gr"
        SUBWORD.o!,   // "gro"
        SUBWORD.a!,   // "groa"
        SUBWORD.n!,   // "groan"
        BACKUP0,      // "groan"
        SUBWORD.e!,   // "groane"
        SUBWORD.r!,   // "groaner"
      ],
    })))
    const actual = Lexicon.fromJSON(Lexicon.toJSON(
      compile({ words, alphabet, name, description, clearInterval })
    ))
    expect(actual).toEqual(expected)
  })

  it('should roundtrip a word list', () => {
    const words = ['blue', 'bluer', 'bluest', 'green', 'greener', 'greenest']
    const alphabet = [...new Set(words.join(''))]
    const name = 'Test Lexicon'
    const description = 'Lexicon for testing.'
    const clearInterval = 16
    const lexicon = compile({ words, alphabet, name, description, clearInterval })
    const binary = Lexicon.encode(lexicon).finish()
    const wordList = new WordList(binary)
    expect([...wordList]).toEqual(words)
  })
})
