/**
 * @file Generation of SWDICT metadata about accent marks on Spanish vowels.
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

const SORTED_TOGETHER = [
  ["a", "á"],
  ["e", "é"],
  ["i", "í"],
  ["o", "ó"],
  ["u", "ú", "ü"],
];
type SortingInfo = {
  baseLetter: string;
  indexInGroup: bigint;
  groupSize: bigint;
  group: ReadonlyArray<string>;
};
const SORTING_INFO = new Map<string, SortingInfo>;
SORTED_TOGETHER.forEach(group => {
  for (let index = 0; index < group.length; ++index) {
    SORTING_INFO.set(group[index]!, {
      baseLetter: group[0]!,
      indexInGroup: BigInt(index),
      groupSize: BigInt(group.length),
      group,
    });
  }
});

export function extractEsMetadata(word: string): [string, bigint] {
  let s = "";
  let n = 0n;
  const chars = Array.from(word);  // Split by code points.
  for (let index = 0; index < chars.length; ++index) {
    const c = chars[index]!;
    const info = SORTING_INFO.get(c);
    if (info) {
      n *= info.groupSize;
      n += info.indexInGroup;
      s += info.baseLetter;
    } else {
      s += c;
    }
  }
  return [s, n];
}

export function applyEsMetadata(baseWord: string, metadata: bigint): string {
  const chars = Array.from(baseWord);
  let n = metadata;
  for (let index = chars.length; index--;) {
    const baseChar = chars[index]!;
    const info = SORTING_INFO.get(baseChar);
    if (info) {
      chars[index] = info.group[Number(n % info.groupSize)]!;
      n /= info.groupSize;
    }
  }
  if (n !== 0n) {
    throw new RangeError(`Metadata ${metadata} out of range for base word "${baseWord}".`);
  }
  return chars.join("");
}
