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

export function arraysEqual<T>(array1: Array<T>, array2: Array<T>) {
  return array1.length === array2.length &&
    array1.keys().every(k => array1[k] === array2[k])
}
