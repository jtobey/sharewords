import { expect, describe, it } from 'bun:test'
import { compile } from './compiler.js'
import { Lexicon } from './dict.js'

describe('compiler', () => {
  it('should compile a lexicon', () => {
    const words = ['the', 'three', 'green', 'peas']
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
})
