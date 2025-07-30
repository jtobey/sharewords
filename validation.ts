/** Returns true if all of the indices are valid for a sequence of the given length. */
export function indicesOk(arrayLength: number, ...indices: Array<number>) {
  for (const index of indices) {
    if (index !== Math.floor(index) || index < 0 || index >= arrayLength) return false
  }
  return true
}

/** Throws RangeError if any of the indices are not valid for a sequence of the given length. */
export function checkIndices(arrayLength: number, ...indices: Array<number>) {
  for (const index of indices) {
    if (!indicesOk(arrayLength, index)) {
      throw new RangeError(`Index ${index} is out of range 0..${arrayLength - 1}.`)
    }
  }
}

/** Shallow comparison of two arrays. */
export function arraysEqual<T>(a1: ReadonlyArray<T>, a2: ReadonlyArray<T>, warnIfNot=true) {
  if (a1.length === a2.length && a1.keys().every(k => a1[k] === a2[k])) {
    return true
  }
  if (warnIfNot) console.warn(`[${a1}] does not equal [${a2}]`)
  return false
}

/** Shallow comparison of two objects, ignoring key order. */
export function objectsEqual(o1: Readonly<{[key: string]: any}>, o2: Readonly<{[key: string]: any}>) {
  const keys = Object.keys(o1).sort()
  if (!arraysEqual(keys, Object.keys(o2).sort(), false)) return false
  return keys.every(key => o1[key] === o2[key])
}
