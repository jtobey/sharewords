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

import { codePointCompare } from "./code_point_compare.js";

/**
 * A SWDICT file entry.
 */
export type Word = {
  toString: () => string;
  metadata: Iterable<bigint>;
  subwords: Iterable<Subword>;
};

/**
 * A subword is typically a letter.
 */
export type Subword = {
  toString: () => string;
  metadata: Iterable<bigint>;
};

export class SubwordImpl implements Subword {
  constructor(
    private str: string,
    public metadata: bigint[] = [],
  ) {}
  toString() {
    return this.str;
  }
};

export class WordImpl<SubwordType extends Subword = Subword> implements Word {
  constructor(
    public subwords: SubwordType[],
    public metadata: bigint[] = [],
  ) {}

  toString() {
    return this.subwords.map(subword => subword.toString()).join("");
  }
};

/**
 * Returns -1 if {left} sorts before {right}, 0 if equal, 1 otherwise.
 */
export function wordCompare(left: Word, right: Word): -1 | 0 | 1 {
  const leftIter = left.subwords[Symbol.iterator]();
  const rightIter = right.subwords[Symbol.iterator]();
  for (;;) {
    const { value: leftSubword } = leftIter.next();
    const { value: rightSubword } = rightIter.next();
    if (leftSubword === undefined && rightSubword === undefined) {
      return 0;
    } else if (leftSubword === undefined) {
      // left is a prefix of right.
      return -1;
    } else if (rightSubword === undefined) {
      // right is a prefix of left.
      return 1;
    }
    const comparison = codePointCompare(leftSubword.toString(), rightSubword.toString());
    if (comparison) return comparison;
  }
}
