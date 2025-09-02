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
import { describe, test, expect, beforeAll, afterAll } from 'bun:test'
import { makeDictionary, PlayRejectedError } from './dictionary.js'
import { loadTranslations } from '../i18n.js'
import { compile } from '../dict/compiler.js'
import { Lexicon } from '../dict/swdict.js'

describe('makeDictionary', () => {
  beforeAll(async () => {
    await loadTranslations('en')
  })

  describe('custom dictionary', () => {
    let dictBytes: Uint8Array
    const dictUrl = 'http://localhost/test-dictionary.swdict'
    const originalFetch = globalThis.fetch

    beforeAll(async () => {
      const lexicon = await compile({
        words: ['hello', 'world'],
        name: 'Test Dictionary',
        description: 'A dictionary for testing',
      })
      // The generated `dict.ts` is from an older version of ts-proto
      // that has a `finish()` method on the writer.
      dictBytes = (Lexicon.encode(lexicon) as any).finish()

      const mockFetch = async (url: string | URL, init?: RequestInit): Promise<Response> => {
        if (url.toString() === dictUrl) {
          return new Response(dictBytes)
        }
        return new Response('Not Found', { status: 404 })
      }
      globalThis.fetch = Object.assign(mockFetch, originalFetch)
    })

    afterAll(() => {
        globalThis.fetch = originalFetch
    })

    test('accepts valid words', async () => {
      const dictionary = makeDictionary({ dictionaryType: 'custom', dictionarySettings: dictUrl, baseUrl: 'http://localhost/' })
      await expect(dictionary('hello')).resolves.toBeUndefined()
      await expect(dictionary('world')).resolves.toBeUndefined()
      await expect(dictionary('HELLO')).resolves.toBeUndefined() // testing case-insensitivity
    })

    test('rejects invalid words', async () => {
      const dictionary = makeDictionary({ dictionaryType: 'custom', dictionarySettings: dictUrl, baseUrl: 'http://localhost/' })
      await expect(dictionary('goodbye')).rejects.toThrow(PlayRejectedError)
    })

    test('rejects multiple words with one invalid', async () => {
        const dictionary = makeDictionary({ dictionaryType: 'custom', dictionarySettings: dictUrl, baseUrl: 'http://localhost/' })
        await expect(dictionary('hello', 'goodbye')).rejects.toThrow(PlayRejectedError)
    })

    test('reports correct invalid words', async () => {
        const dictionary = makeDictionary({ dictionaryType: 'custom', dictionarySettings: dictUrl, baseUrl: 'http://localhost/' })
        const promise = dictionary('hello', 'goodbye', 'world', 'cruel')
        await expect(promise).rejects.toThrow(PlayRejectedError)
        await expect(promise).rejects.toThrow(`Not words in Test Dictionary: goodbye, cruel. Play rejected.`)
    })
  })
})
