import { t } from '../i18n.js'

export type Dictionary = ((...possibleWords: Array<string>) => Promise<void>)
export type DictionaryType = 'permissive' | 'freeapi' | 'custom'

export class PlayRejectedError extends Error {
  constructor(message: string) {
    super(t('error.play_rejected.play_rejected', { message }))
    this.name = 'PlayRejected'
  }
}

export function makeDictionary(dictionaryType: DictionaryType, dictionarySettings: any) {
  if (dictionaryType === 'permissive') return async (...words: string[]) => null
  if (dictionaryType === 'custom') return makeCustomDictionary(dictionarySettings)
  if (dictionaryType === 'freeapi') {
    let urlTemplate!: string, dictionaryName!: string
    if (dictionarySettings) {
      if (typeof dictionarySettings !== 'string') {
        throw new Error(`Dictionary type "${dictionaryType}" requires setting a URL template.`)
      }
      urlTemplate = dictionarySettings
      dictionaryName = dictionarySettings
    } else {
      urlTemplate = 'https://api.dictionaryapi.dev/api/v2/entries/en/{lower}'
      dictionaryName = 'Free Dictionary API'
    }
    return makeUrlTemplateDictionary(urlTemplate, dictionaryName)
  }
  throw new Error(`dictionaryType ${dictionaryType} is not supported.`)
}

class WordNotInDictionaryError extends PlayRejectedError {
  constructor(readonly word: string, readonly dictionaryName: string, readonly status: string) {
    super(t('error.play_rejected.word_not_in_dictionary', { word, status, dictionaryName }))
    this.name = 'WordNotInDictionaryError'
  }
}

class WordNotFoundError extends WordNotInDictionaryError {
  constructor(word: string, dictionaryName: string) {
    super(word, dictionaryName, t('error.play_rejected.status.not_found'))
    this.name = 'WordNotFoundError'
  }
}

class NoDefinitionError extends WordNotInDictionaryError {
  constructor(word: string, dictionaryName: string) {
    super(word, dictionaryName, t('error.play_rejected.status.has_no_definition'))
    this.name = 'NoDefinitionError'
  }
}

function makeUrlTemplateDictionary(urlTemplate: string, dictionaryName: string) {
  return async (...words: Array<string>) => {
    const promises: Array<Promise<WordNotInDictionaryError | null>> = words.map(word => {
      const url = urlTemplate.replace('{lower}', word.toLowerCase())
      return checkWordUsingUrl(word, url, dictionaryName)
    })
    const results = await Promise.all(promises)
    const errors = results.filter(r => r)
    if (errors.length === 0) return  // Words accepted.
    if (errors.length === 1) throw errors[0]
    const invalidWords = errors.map(wnidError => wnidError!.word)
    throw new PlayRejectedError(t('error.play_rejected.not_words_in_dictionary', { dictionaryName: errors[0]!.dictionaryName, invalidWords: invalidWords.join(', ') }))
  }
}

/**
 * @returns null if the word is valid.
 * @returns {WordNotInDictionaryError} if `wordToCheck` is not a word according to the dictionary.
 * @throws {Error} on failure to check the word.
 */
async function checkWordUsingUrl(wordToCheck: string, url: string, dictionaryName: string) {
  try {
    const response = await fetch(url)
    if (!response.ok) {
      if (response.status === 404) {
        return new WordNotFoundError(wordToCheck, dictionaryName)
      } else {
        throw new Error(`Error validating word "${wordToCheck}" with ${dictionaryName} (Status: ${response.status} ${response.statusText}).`)
      }
    }
    const data = await response.json()
    if (!Array.isArray(data) || data.length === 0 || (data[0] && data[0].title === "No Definitions Found")) {
      return new NoDefinitionError(wordToCheck, dictionaryName)
    }
    // TODO: Reject words defined only as abbreviations.
    console.log(`Word "${wordToCheck}" is valid according to ${dictionaryName}.`)
    return null  // Word accepted.
  } catch (error) {
    console.error(`Network or other error validating word "${wordToCheck}":`, error)
    throw new Error(`Could not reach ${dictionaryName} to validate "${wordToCheck}". Check connection or API status.`)
  }
}

function makeCustomDictionary(dictionarySettings: any) {
  return async (...words: Array<string>) => {
    // TODO - fetch swdict, check for words.
    console.warn(`I want to validiate [${words}] using ${dictionarySettings}.`)
  }
}
