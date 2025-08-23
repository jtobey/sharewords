export type BagDefaults = {
  letterCounts: Map<string, number>
  letterValues: Map<string, number>
}

type _BagDefaults = {
  letterCounts: {[key: string]: number}
  letterValues: {[key: string]: number}
}

const DEFAULT_BAG_LANGUAGE = 'en'

const BAG_DEFAULTS: {[key: string]: _BagDefaults} = {
  en: {
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
  },
  es: {
    letterCounts: {
      A: 9, B: 2, C: 2, D: 4, E: 10, F: 2, G: 2, H: 2, I: 8, J: 2,
      K: 1, L: 4, M: 2, N: 6, O: 10, P: 2, Qu: 2, R: 6, S: 5, T: 6,
      U: 4, V: 2, X: 1, Y: 2, Z: 2, '': 2
    },
    letterValues: {
      A: 1, B: 3, C: 4, D: 2, E: 1, F: 4, G: 3, H: 4, I: 1, J: 4,
      K: 10, L: 1, M: 3, N: 1, O: 1, P: 3, Qu: 5, R: 1, S: 1, T: 1,
      U: 2, V: 4, X: 10, Y: 4, Z: 4, '': 0
    },
  },
}

export function getBagLanguages(): Iterable<string> {
  return Object.keys(BAG_DEFAULTS)
}

export function getBagDefaults(bagLanguage: string): BagDefaults {
  let defaults = BAG_DEFAULTS[bagLanguage]
  if (!defaults) {
    console.warn(`Unsupported bag language "${bagLanguage}", defaulting to "${DEFAULT_BAG_LANGUAGE}".`)
    defaults = BAG_DEFAULTS[DEFAULT_BAG_LANGUAGE]!
  }
  return {
    letterCounts: new Map(Object.entries(defaults.letterCounts)),
    letterValues: new Map(Object.entries(defaults.letterValues)),
  }
}
