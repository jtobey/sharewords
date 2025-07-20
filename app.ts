import { Tile } from './tile.js';
import type { Bag } from './bag.js';
import { HonorSystemBag } from './honor_system_bag.js';

let bag: Bag<Tile> = new HonorSystemBag<Tile>([...Array(100).keys().map(n => new Tile('A', 1, false, '', `tile-${n}`))], 17)
document.getElementsByTagName('button')[0]?.addEventListener(
  'click', () => alert(`${bag.size} in bag`))
