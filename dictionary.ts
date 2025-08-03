export type Dictionary = ((...possibleWords: Array<string>) => Promise<void>)
export type DictionaryType = 'permissive' | 'freeapi' | 'custom'
const DICTIONARY_TYPES: ReadonlyArray<DictionaryType> = ['permissive', 'freeapi', 'custom']

export class PlayRejectedError extends Error {
  constructor(message: string) {
    super(`${message} Play rejected.`)
    this.name = 'PlayRejected'
  }
}

export function makeDictionary(dictionaryType: DictionaryType, dictionarySettings: any) {
  if (!DICTIONARY_TYPES.includes(dictionaryType)) {
    // Unreachable.
    throw new Error(`dictionaryType ${dictionaryType} is not supported.`)
  }
  return async (...words: Array<string>) => {
    const promises: Array<Promise<WordNotInDictionaryError | null>> = words.map(word => {
      return checkWord(word, dictionaryType, dictionarySettings)
    })
    const results = await Promise.all(promises)
    const errors = results.filter(r => r)
    if (errors.length === 0) return  // Words accepted.
    if (errors.length === 1) throw errors[0]
    const invalidWords = errors.map(wnidError => wnidError!.word)
    throw new PlayRejectedError(`Words rejected: ${invalidWords}.`)
  }
}

class WordNotInDictionaryError extends PlayRejectedError {
  constructor(readonly word: string, readonly dictionaryName: string, readonly status: string) {
    super(`Word "${word}" ${status} in ${dictionaryName}.`)
    this.name = 'WordNotInDictionaryError'
  }
}

class WordNotFoundError extends WordNotInDictionaryError {
  constructor(word: string, dictionaryName: string) {
    super(word, dictionaryName, 'not found')
    this.name = 'WordNotFoundError'
  }
}

class NoDefinitionError extends WordNotInDictionaryError {
  constructor(word: string, dictionaryName: string) {
    super(word, dictionaryName, 'has no definition')
    this.name = 'NoDefinitionError'
  }
}

/**
 * @returns null if the word is valid.
 * @returns {WordNotInDictionaryError} if `wordToCheck` is not a word according to the dictionary.
 * @throws {Error} on failure to check the word.
 */
async function checkWord(wordToCheck: string, dictionaryType: DictionaryType, dictionarySettings: any) {
  if (dictionaryType === 'permissive') return null  // Anything is a word.

  let urlPrefix = ''
  let dictionaryNameForAlert = ''

  if (dictionaryType === 'freeapi') {
    urlPrefix = 'https://api.dictionaryapi.dev/api/v2/entries/en/'
    dictionaryNameForAlert = 'Free Dictionary API'
  } else if (dictionaryType === 'custom') {
    dictionaryNameForAlert = 'Custom Dictionary'
  }
  if (typeof dictionarySettings === 'string') {
    urlPrefix = dictionarySettings
  }
  if (!urlPrefix) {
    throw new Error('Custom dictionary requires setting a URL prefix.')
  }

  const url = urlPrefix + wordToCheck.toLowerCase()
  try {
    const response = await fetch(url)
    if (!response.ok) {
      if (response.status === 404) {
        return new WordNotFoundError(wordToCheck, dictionaryNameForAlert)
      } else {
        throw new Error(`Error validating word "${wordToCheck}" with ${dictionaryNameForAlert} (Status: ${response.status} ${response.statusText}).`)
      }
    }
    if (dictionaryType === 'freeapi') {
      const data = await response.json()
      if (!Array.isArray(data) || data.length === 0 || (data[0] && data[0].title === "No Definitions Found")) {
        return new NoDefinitionError(wordToCheck, dictionaryNameForAlert)
      }
    }
    // TODO: Reject words defined only as abbreviations.
    console.log(`Word "${wordToCheck}" is valid according to ${dictionaryNameForAlert}.`)
    return null  // Word accepted.
  } catch (error) {
    console.error(`Network or other error validating word "${wordToCheck}":`, error)
    throw new Error(`Could not reach ${dictionaryNameForAlert} to validate "${wordToCheck}". Check connection or API status.`)
  }
}
