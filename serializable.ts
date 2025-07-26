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
