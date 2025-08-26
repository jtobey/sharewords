/**
 * Compiles a word list into a Lexicon protobuf.
 */

import { codePointCompare } from './code_point_compare.js'
import { Lexicon } from './dict.js'

export async function compile({
  words, name, description, clearInterval=1024, alphabet=null
}: {
  words: Iterable<string> | AsyncIterable<string>,
  name: string,
  description: string,
  clearInterval?: number,
  alphabet?: Array<string> | null,
}): Promise<Lexicon> {
  if (!alphabet) {
    const tempWords: string[] = []
    const subwords = new Set<string>
    for await (const word of words) {
      tempWords.push(word)
      for (const subword of [...word]) {
        subwords.add(subword)
      }
    }
    tempWords.sort(codePointCompare)
    words = tempWords
    alphabet = [...subwords]
    alphabet.sort(codePointCompare)
  }
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
  for await (const wordStr of words) {
    if (lastWordStr !== null) {
      switch (codePointCompare(lastWordStr, wordStr)) {
        case 0:
          console.warn(`Duplicate word "${wordStr}".`)
          continue
        case 1:
          throw new Error(`Alphabet passed but words are out of order: "${lastWordStr}" should follow "${wordStr}".`)
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
    const subwordsToAdd = word.splice(commonPrefixLength)
    if (!subwordsToAdd.every(subword => macroIndexForSubword.has(subword))) {
      // TODO - Automatically build the alphabet.
      throw new Error(`Word "${wordStr}" contains characters missing from alphabet.`)
    }
    for (const subword of subwordsToAdd) {
      lexicon.instructions.push(macroIndexForSubword.get(subword)!)
      wordBuffer.push(subword)
    }
  }
  return lexicon
}
