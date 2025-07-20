import { expect, describe, it } from "bun:test";
import { HonorSystemBag } from './honor_system_bag.js';

describe("honor system bag", () => {
    it("should know its size", () => {
        expect(new HonorSystemBag([0, 1, 2]).size).toEqual(3)
    })
})
