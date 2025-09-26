/**
 * @file A word with metadata in the form of bigint lists.
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

import { InlineMetadata } from "./swdict.ts";
import { codePointCompare } from "./code_point_compare.js";
import type { SortingInfo } from "./sortalike.js";

/**
 * A SWDICT file entry.
 */
export type Word = {
  toString: () => string;
  metadata: Iterable<InlineMetadata>;
  subwords: Iterable<Subword>;
};

/**
 * A subword is typically a letter.
 */
export type Subword = {
  toString: () => string;
  metadata: Iterable<InlineMetadata>;
};

export class SubwordImpl implements Subword {
  constructor(
    private str: string,
    public metadata: InlineMetadata[] = [],
  ) {}
  toString() {
    return this.str;
  }
};

export class WordImpl<SubwordType extends Subword = Subword> implements Word {
  constructor(
    public subwords: SubwordType[],
    public metadata: InlineMetadata[] = [],
  ) {}

  toString() {
    return this.subwords.map(subword => subword.toString()).join("");
  }
};

/**
 * Returns -1 if {left} sorts before {right}, 0 if equal, 1 otherwise.
 * @param sortingInfo maps lowercase subwords to `SortingInfo`.
 */
export function wordCompare(left: Word, right: Word, sortingInfo?: Map<string, SortingInfo>): -1 | 0 | 1 {
  const leftIter = left.subwords[Symbol.iterator]();
  const rightIter = right.subwords[Symbol.iterator]();
  let rawComparison: -1 | 0 | 1 = 0;
  let secondaryComparison: -1 | 0 | 1 = 0;
  for (;;) {
    const { value: leftSubword } = leftIter.next();
    const { value: rightSubword } = rightIter.next();
    if (leftSubword === undefined && rightSubword === undefined) {
      return secondaryComparison || rawComparison;
    } else if (leftSubword === undefined) {
      // left is a prefix of right.
      return -1;
    } else if (rightSubword === undefined) {
      // right is a prefix of left.
      return 1;
    }
    const leftString = leftSubword.toString();
    const rightString = rightSubword.toString();
    if (leftString === rightString) {
      continue;
    }
    const leftLower = leftString.toLowerCase();
    const rightLower = rightString.toLowerCase();
    if (leftLower !== rightLower) {
      let baseComparison!: -1 | 0 | 1;
      if (sortingInfo) {
        const leftInfo = sortingInfo.get(leftLower);
        const rightInfo = sortingInfo.get(rightLower);
        const leftBase = leftInfo?.baseSubword ?? leftLower;
        const rightBase = rightInfo?.baseSubword ?? rightLower;
        baseComparison = codePointCompare(leftBase, rightBase);
        if (!baseComparison && !secondaryComparison && leftInfo && rightInfo) {
          const leftSecondary = leftInfo.indexInGroup;
          const rightSecondary = rightInfo.indexInGroup;
          if (leftSecondary !== rightSecondary) {
            secondaryComparison = (leftSecondary < rightSecondary) ? -1 : 1;
          }
        }
      } else {
        baseComparison = codePointCompare(leftLower, rightLower);
      }
      if (baseComparison) {  // Should always be true.
        return baseComparison;
      }
    }
    if (!secondaryComparison) {
      rawComparison ||= codePointCompare(leftString, rightString);
    }
  }
}
