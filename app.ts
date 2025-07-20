import type { Bag } from './bag.js';
import { HonorSystemBag } from './honor_system_bag.js';

let bag: Bag<number> = new HonorSystemBag<number>([...Array(100).keys()])
document.getElementsByTagName('button')[0]?.addEventListener('click', () => alert(`${bag.size} in bag`))
