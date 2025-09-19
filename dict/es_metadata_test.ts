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

import { expect, describe, it } from "bun:test";
import { extractEsMetadata, applyEsMetadata } from "./es_metadata.js";

describe("es metadata", () => {
  it("should extract simple metadata", () => {
    expect(extractEsMetadata("y")).toEqual(["y", 0n]);
    expect(extractEsMetadata("que")).toEqual(["que", 0n]);
  });

  it("should extract accent mark metadata", () => {
    expect(extractEsMetadata("qué")).toEqual(["que", 1n]);
    expect(extractEsMetadata("única")).toEqual(["unica", 4n]);
    expect(extractEsMetadata("vínculo")).toEqual(["vinculo", 6n]);
    expect(extractEsMetadata("sólo")).toEqual(["solo", 2n]);
    expect(extractEsMetadata("papá")).toEqual(["papa", 1n]);
  });

  it("should extract diaeresis metadata", () => {
    expect(extractEsMetadata("pingüino")).toEqual(["pinguino", 8n]);
    expect(extractEsMetadata("averígüelo")).toEqual(["averiguelo", 20n]);
    expect(extractEsMetadata("averigüé")).toEqual(["averigue", 5n]);
  });

  it("should apply metadata", () => {
    expect(applyEsMetadata("y", 0n)).toEqual("y");
    expect(applyEsMetadata("que", 0n)).toEqual("que");
    expect(applyEsMetadata("vinculo", 6n)).toEqual("vínculo");
    expect(applyEsMetadata("pinguino", 8n)).toEqual("pingüino");
    expect(applyEsMetadata("averiguelo", 20n)).toEqual("averígüelo");
  });
});
