import type { Bag } from './bag.js'

export class HonorSystemBag<Element> implements Bag<Element> {
  constructor(public readonly elements: Array<Element>) {}
  get size() { return this.elements.length }
}
