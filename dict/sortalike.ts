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

import { WordImpl, SubwordImpl, type Word, type Subword } from "./word.js";

export type SortingInfo = {
  baseSubword: string;
  indexInGroup: bigint;
  groupSize: bigint;
  group: ReadonlyArray<string>;
};

/**
 * Returns {word} without accent marks that do not affect sorting, but with a
 * metadata element that encodes the removed information.
 */
export function extractBaseWord(
  word: Word,
  sortingInfo: ReadonlyMap<string, SortingInfo>,
): WordImpl {
  const baseSubwords: Subword[] = [];
  let wordMetadata = 0n;
  for (const subword of word.subwords) {
    const info = sortingInfo.get(subword.toString());
    if (info) {
      wordMetadata *= info.groupSize;
      wordMetadata += info.indexInGroup;
      baseSubwords.push(new SubwordImpl(info.baseSubword));
    } else {
      baseSubwords.push(subword);
    }
  }
  return new WordImpl([wordMetadata], baseSubwords);
}

export function buildSortingInfoMap(
  groups: ReadonlyArray<ReadonlyArray<string>>,
): Map<string, SortingInfo> {
  const map = new Map<string, SortingInfo>;
  groups.forEach(group => {
    for (let index = 0; index < group.length; ++index) {
      map.set(group[index]!, {
        baseSubword: group[0]!,
        indexInGroup: BigInt(index),
        groupSize: BigInt(group.length),
        group,
      });
    }
  });
  return map;
}

export function makeSortalike(
  baseWord: Word,
  wordMetadata: bigint,
  sortingInfo: ReadonlyMap<string, SortingInfo>,
): WordImpl {
  const subwords = [...baseWord.subwords];
  let n = wordMetadata;
  for (let index = subwords.length; index--;) {
    const subword = subwords[index]!.toString();
    const info = sortingInfo.get(subword);
    if (info) {
      const newSubword = info.group[Number(n % info.groupSize)]!;
      subwords[index] = new SubwordImpl(newSubword);
      n /= info.groupSize;
    }
  }
  if (n !== 0n) {
    throw new RangeError(`Metadata ${wordMetadata} out of range for base word "${baseWord}".`);
  }
  return new WordImpl([], subwords);
}
