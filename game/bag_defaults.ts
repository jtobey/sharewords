/**
 * @file Letters and values of tiles in the bag.
 */

export type BagDefaults = {
  letterCounts: Map<string, number>
  letterValues: Map<string, number>
}

type _BagDefaults = {
  name: string,
  letterCounts: {[key: string]: number}
  letterValues: {[key: string]: number}
  dictionaries:  {
    dictionaryType: string
    dictionarySettings: any
  }[]
}

const BAG_DEFAULTS = new Map<string, _BagDefaults>([
  ['en', {
    name: 'English',
    letterCounts: {
      A: 9, B: 2, C: 2, D: 4, E: 12, F: 2, G: 2, H: 2, I: 9, J: 1,
      K: 1, L: 4, M: 2, N: 6, O: 8, P: 2, Q: 1, R: 6, S: 5, T: 6,
      U: 4, V: 2, W: 2, X: 1, Y: 2, Z: 1, '': 2
    },
    letterValues: {
      A: 1, B: 3, C: 4, D: 2, E: 1, F: 4, G: 3, H: 4, I: 1, J: 9,
      K: 5, L: 1, M: 3, N: 1, O: 1, P: 3, Q: 10, R: 1, S: 1, T: 1,
      U: 2, V: 5, W: 4, X: 8, Y: 4, Z: 10, '': 0
    },
    dictionaries: [
      { dictionaryType: 'freeapi', dictionarySettings: null },
    ],
  }],
  ['es', {
    name: 'Español',
    letterCounts: {
      A: 10, B: 2, C: 2, D: 3, E: 10, F: 2, G: 2, H: 2, I: 9, J: 2, K: 1,
      L: 4, M: 2, N: 6, Ñ: 1, O: 11, P: 2, Qu: 2, R: 5, S: 5, T: 4,
      U: 4, V: 2, X: 1, Y: 2, Z: 2, '': 2
    },
    letterValues: {
      A: 1, B: 3, C: 4, D: 2, E: 1, F: 4, G: 3, H: 4, I: 1, J: 4,
      K: 10, L: 1, M: 3, N: 1, Ñ: 5, O: 1, P: 3, Qu: 5, R: 1, S: 1, T: 1,
      U: 2, V: 4, X: 10, Y: 4, Z: 4, '': 0
    },
    dictionaries: [
    ],
  }],
])

export function getBagLanguages(): Iterable<{
  code: string
  name: string
  dictionaries: {
    dictionaryType: string
    dictionarySettings: any
  }[]
}> {
  return BAG_DEFAULTS.entries().map(([key, value]) => ({
    code: key,
    name: value.name,
    dictionaries: JSON.parse(JSON.stringify(value.dictionaries)),
  }))
}

export function getBagDefaults(bagLanguage: string, tileCount?: number): BagDefaults | null;
export function getBagDefaults(bagLanguage: '', tileCount?: number): BagDefaults;
export function getBagDefaults(bagLanguage: 'en', tileCount?: number): BagDefaults;

export function getBagDefaults(bagLanguage: string, tileCount?: number): BagDefaults | null {
  if (bagLanguage === '') {
    return {letterCounts: new Map, letterValues: new Map}
  }
  const defaults = BAG_DEFAULTS.get(bagLanguage)
  if (!defaults) return null
  const letterCounts = new Map(Object.entries(defaults.letterCounts))
  if (tileCount !== undefined) {
    const defaultTileCount = [...letterCounts.values()].reduce((a, b) => a + b, 0)
    if (defaultTileCount > 0) {
      const scale = tileCount / defaultTileCount
      let total = 0
      for (const [letter, count] of letterCounts.entries()) {
        const newCount = Math.round(count * scale)
        letterCounts.set(letter, newCount)
        total += newCount
      }
      // Add or remove tiles to match tileCount due to rounding
      let diff = tileCount - total
      const step = Math.sign(diff)
      if (step !== 0) {
        const letters = [...letterCounts.keys()]
        while (diff !== 0) {
          const letter = letters[Math.floor(Math.random() * letters.length)]!
          const count = letterCounts.get(letter)!
          if (count + step >= 0) {
            letterCounts.set(letter, count + step)
            diff -= step
          }
        }
      }
    }
  }
  return {
    letterCounts,
    letterValues: new Map(Object.entries(defaults.letterValues)),
  }
}

export function hasBagDefaults(bagLanguage: string) {
  return BAG_DEFAULTS.has(bagLanguage)
}
