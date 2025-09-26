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

export type SortingInfo = {
  baseSubword: string;
  indexInGroup: bigint;
  groupSize: bigint;
  group: ReadonlyArray<string>;
};

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
