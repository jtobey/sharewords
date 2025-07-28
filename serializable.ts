export type Serializable = (
  { toJSON(): any } |
  { [key: string]: Serializable } |
  ReadonlyArray<Serializable> |
  string |
  number |
  boolean |
  null)

export function toJSON(s: Serializable): any {
  if (s && typeof s === 'object' && 'toJSON' in s) return (s as {toJSON(): any}).toJSON()
  return s
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
