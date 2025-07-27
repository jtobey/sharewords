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

export function arraysEqual<T>(a1: Array<T>, a2: Array<T>) {
  if (a1.length === a2.length && a1.keys().every(k => a1[k] === a2[k])) {
    return true
  }
  console.warn(`[${a1}] does not equal [${a2}]`)
  return false
}
