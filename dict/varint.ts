export function writeVarint(data: number[], n: number | bigint) {
  n = BigInt(n);
  while (n >= 0x80n) {
    data.push(Number((n & 0x7fn) | 0x80n));
    n >>= 7n;
  }
  data.push(Number(n));
}

export function toVarint(n: number | bigint) {
  const data: number[] = [];
  writeVarint(data, n);
  return new Uint8Array(data);
}
