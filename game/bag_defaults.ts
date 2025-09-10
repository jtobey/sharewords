/**
 * @file Letters and values of tiles in the bag.
 */
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

export type BagDefaults = {
  letterCounts: Map<string, number>;
  letterValues: Map<string, number>;
};

type _BagDefaults = {
  name: string;
  letterCounts: { [key: string]: number };
  letterValues: { [key: string]: number };
};

const BAG_DEFAULTS = new Map<string, _BagDefaults>([
  [
    "en",
    {
      name: "English",
      letterCounts: {
        A: 721,
        B: 187,
        C: 360,
        D: 363,
        E: 1122,
        F: 134,
        G: 293,
        H: 212,
        I: 813,
        J: 100,
        K: 100,
        L: 494,
        M: 260,
        N: 636,
        O: 573,
        P: 271,
        Q: 100,
        R: 683,
        S: 909,
        T: 600,
        U: 327,
        V: 100,
        W: 100,
        X: 100,
        Y: 142,
        Z: 100,
        "": 200,
      },
      letterValues: {
        A: 1,
        B: 4,
        C: 4,
        D: 2,
        E: 1,
        F: 4,
        G: 3,
        H: 4,
        I: 1,
        J: 9,
        K: 5,
        L: 2,
        M: 3,
        N: 1,
        O: 1,
        P: 3,
        Q: 10,
        R: 1,
        S: 1,
        T: 1,
        U: 2,
        V: 5,
        W: 4,
        X: 8,
        Y: 4,
        Z: 8,
        "": 0,
      },
    },
  ],
  [
    "es",
    {
      name: "Español",
      letterCounts: {
        A: 1245,
        B: 158,
        C: 449,
        D: 397,
        E: 1046,
        F: 100,
        G: 156,
        H: 103,
        I: 721,
        J: 100,
        K: 100,
        L: 406,
        M: 306,
        N: 626,
        Ñ: 100,
        O: 816,
        P: 240,
        Qu: 100,
        R: 812,
        S: 662,
        T: 494,
        U: 244,
        V: 119,
        X: 100,
        Y: 100,
        Z: 100,
        "": 200,
      },
      letterValues: {
        A: 1,
        B: 3,
        C: 2,
        D: 2,
        E: 1,
        F: 4,
        G: 4,
        H: 4,
        I: 1,
        J: 5,
        K: 9,
        L: 2,
        M: 2,
        N: 1,
        Ñ: 10,
        O: 1,
        P: 3,
        Qu: 6,
        R: 1,
        S: 1,
        T: 1,
        U: 2,
        V: 4,
        X: 8,
        Y: 5,
        Z: 5,
        "": 0,
      },
    },
  ],
]);

export function getBagLanguages(): Iterable<{
  code: string;
  name: string;
}> {
  return BAG_DEFAULTS.entries().map(([key, value]) => ({
    code: key,
    name: value.name,
  }));
}

export function getBagDefaults(
  bagLanguage: string,
  tileCount?: number,
): BagDefaults | null;
export function getBagDefaults(
  bagLanguage: "",
  tileCount?: number,
): BagDefaults;
export function getBagDefaults(
  bagLanguage: "en",
  tileCount?: number,
): BagDefaults;

export function getBagDefaults(
  bagLanguage: string,
  tileCount?: number,
): BagDefaults | null {
  if (bagLanguage === "") {
    return { letterCounts: new Map(), letterValues: new Map() };
  }
  const defaults = BAG_DEFAULTS.get(bagLanguage);
  if (!defaults) return null;
  const letterCounts = new Map(Object.entries(defaults.letterCounts));
  if (tileCount !== undefined) {
    const defaultTileCount = [...letterCounts.values()].reduce(
      (a, b) => a + b,
      0,
    );
    if (defaultTileCount > 0) {
      const newLetterCounts = new Map<string, number>();
      for (const letter of letterCounts.keys()) {
        newLetterCounts.set(letter, 0);
      }

      const letterSegments: { letter: string; end: number }[] = [];
      let currentEnd = 0;
      const sortedLetters = [...letterCounts.keys()].sort();
      for (const letter of sortedLetters) {
        const count = letterCounts.get(letter)!;
        currentEnd += count / defaultTileCount;
        letterSegments.push({ letter, end: currentEnd });
      }
      // Ensure the last segment ends at exactly 1.0 to avoid floating point issues
      if (letterSegments.length > 0) {
        letterSegments[letterSegments.length - 1]!.end = 1.0;
      }

      for (let i = 0; i < tileCount; i++) {
        const value = (i + 0.5) / tileCount;
        const segment = letterSegments.find((s) => value < s.end)!;
        newLetterCounts.set(
          segment.letter,
          newLetterCounts.get(segment.letter)! + 1,
        );
      }
      return {
        letterCounts: newLetterCounts,
        letterValues: new Map(Object.entries(defaults.letterValues)),
      };
    }
  }
  return {
    letterCounts,
    letterValues: new Map(Object.entries(defaults.letterValues)),
  };
}

export function hasBagDefaults(bagLanguage: string) {
  return BAG_DEFAULTS.has(bagLanguage);
}
