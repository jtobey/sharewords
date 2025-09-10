/*
Copyright 2025 Google LLC

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    https://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/
// In-memory DOM Storage implementation for tests.

class QuotaExceededError extends DOMException {
  constructor(message: string) {
    super(message, "QuotaExceededError");
  }
}

export class TestStorage implements Storage {
  constructor(
    public maxLength = 100,
    private storage = new Map<string, string>(),
  ) {
    if (typeof maxLength !== "number" || maxLength < 0) {
      throw new Error("maxLength must be a non-negative number.");
    }
  }

  get length() {
    return this.storage.size;
  }
  getItem(key: string) {
    return this.storage.get(key) ?? null;
  }
  removeItem(key: string) {
    this.storage.delete(key);
  }
  clear() {
    this.storage.clear();
  }

  // Sets a new key-value pair in the storage. Throws QuotaExceededError if the maxLength is exceeded.
  setItem(key: string, value: string) {
    if (!this.storage.has(key) && this.length >= this.maxLength) {
      throw new QuotaExceededError(
        "Storage quota exceeded. Maximum length reached.",
      );
    }
    this.storage.set(key, String(value)); // According to Web Storage API, values are always strings.
  }

  // Returns the name of the key at the specified index.
  key(index: number) {
    if (typeof index === "number") {
      const key = Array.from(this.storage.keys())[index];
      if (key !== undefined) return key;
    }
    return null;
  }
}
