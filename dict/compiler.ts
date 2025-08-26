/**
 * Compiles a word list into a Lexicon protobuf.
 */

import { codePointCompare } from './code_point_compare.js'
import { Lexicon } from './dict.js'

export function compile({
  words, alphabet, name, description, clearInterval=1024
}: {
  words: Iterable<string>,
  alphabet: Array<string>,
  name: string,
  description: string,
  clearInterval?: number,
}): Lexicon {
  const lexicon = Lexicon.create({
    metadata: {
      name,
      description,
      clearInterval,
      macros: [{ clear: {} }],
    },
  })
  const metadata = lexicon.metadata!
  const macroIndexForSubword = new Map<string, number>
  for (const subword of alphabet) {
    macroIndexForSubword.set(subword, metadata.macros.length)
    metadata.macros.push({ subword })
  }
  const macroIndexForDeleteZero = metadata.macros.length
  let wordBuffer: string[] = []
  let nextClear = clearInterval
  let lastWordStr: string | null = null
  for (const wordStr of words) {
    if (lastWordStr !== null) {
      // TODO - Automatically sort.
      switch (codePointCompare(lastWordStr, wordStr)) {
        case 0:
          throw new Error(`Duplicate word "${wordStr}".`)
        case 1:
          throw new Error(`Words are out of order: "${lastWordStr}" should follow "${wordStr}".`)
      }
    }
    lastWordStr = wordStr
    const word = [...wordStr]  // Deal in code points, not code units.
    let commonPrefixLength = 0
    if (wordBuffer.length) {
      if (lexicon.instructions.length >= nextClear) {
        lexicon.instructions.push(0)
        wordBuffer.length = 0
        while (lexicon.instructions.length >= nextClear) {
          nextClear += clearInterval
        }
      } else {
        while (
          word.length > commonPrefixLength
            && wordBuffer.length > commonPrefixLength
            && word[commonPrefixLength] === wordBuffer[commonPrefixLength]
        ) {
          ++commonPrefixLength
        }
        const numberOfCharsToDelete = wordBuffer.length - commonPrefixLength
        while (metadata.macros.length - macroIndexForDeleteZero <= numberOfCharsToDelete) {
          metadata.macros.push({
            backup: metadata.macros.length - macroIndexForDeleteZero
          })
        }
        const indexForDeletion = macroIndexForDeleteZero + numberOfCharsToDelete
        lexicon.instructions.push(indexForDeletion)
        wordBuffer.length = commonPrefixLength
      }
    }
    word.splice(commonPrefixLength).forEach(subword => {
      const indexForSubword = macroIndexForSubword.get(subword)
      if (indexForSubword === undefined) {
        // TODO - Automatically build the alphabet.
        throw new Error(`Word "${wordStr}" contains "${subword}" missing from alphabet.`)
      }
      lexicon.instructions.push(indexForSubword)
      wordBuffer.push(subword)
    })
  }
  return lexicon
}
