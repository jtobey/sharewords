/** Interface implemented by classes that can be serialized to JSON. */
export interface Serializable {
  /** Returns this object as JSON-serializable data. */
  toJSON(): any
}

export type Stringifiable = (
  Serializable |
  { [key: string]: Stringifiable } |
  ReadonlyArray<Stringifiable> |
  string |
  number |
  boolean |
  null)

export function arraysEqual<T>(array1: Array<T>, array2: Array<T>) {
  return array1.length === array2.length &&
    array1.keys().every(k => array1[k] === array2[k])
}
