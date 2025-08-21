// In-memory DOM Storage implementation for tests.

class QuotaExceededError extends DOMException {
  constructor(message: string) {
    super(message, 'QuotaExceededError')
  }
}

export class TestStorage implements Storage {
  constructor(
    public maxLength = 100,
    private storage = new Map<string, string>,
  ) {
    if (typeof maxLength !== 'number' || maxLength < 0) {
      throw new Error("maxLength must be a non-negative number.")
    }
  }

  get length() { return this.storage.size }
  getItem(key: string) { return this.storage.get(key) ?? null }
  removeItem(key: string) { this.storage.delete(key) }
  clear() { this.storage.clear() }

  // Sets a new key-value pair in the storage. Throws QuotaExceededError if the maxLength is exceeded.
  setItem(key: string, value: string) {
    if (!this.storage.has(key) && this.length >= this.maxLength) {
      throw new QuotaExceededError("Storage quota exceeded. Maximum length reached.")
    }
    this.storage.set(key, String(value)) // According to Web Storage API, values are always strings.
  }

  // Returns the name of the key at the specified index.
  key(index: number) {
    if (typeof index === 'number') {
      const key = Array.from(this.storage.keys())[index]
      if (key !== undefined) return key
    }
    return null
  }
}
