import { expect, describe, it } from 'bun:test'
import { compile } from './compiler.js'
import { Lexicon } from './dict.js'

describe('compiler', () => {
  it('should compile', () => {
    const words = ['the', 'three', 'green', 'peas']
    const alphabet = [...'aeghnprst']
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
          ...[...Array(6).keys()].map(backup => ({backup})),
        ],
      },
      instructions: [
        3,   // "g"
        7,   // "gr"
        2,   // "gre"
        2,   // "gree"
        5,   // "green"
        15,  // ""
        6,   // "p"
        2,   // "pe"
        1,   // "pea"
        8,   // "peas"
        14,  // ""
        9,   // "t"
        4,   // "th"
        2,   // "the"
        11,  // "th"
        7,   // "thr"
        2,   // "thre"
        2,   // "three"
      ],
    })))
    const actual = Lexicon.fromJSON(Lexicon.toJSON(
      compile({ words, alphabet, name, description })
    ))
    expect(actual).toEqual(expected)
  })
})
