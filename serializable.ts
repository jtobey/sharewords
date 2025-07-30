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
