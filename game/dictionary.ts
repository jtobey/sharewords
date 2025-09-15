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
import { t } from "../i18n.js";
import { WordList } from "../dict/word_list.js";

export abstract class Dictionary {
  abstract checkWords(...possibleWords: Array<string>): void | Promise<void>;
};
export type DictionaryType =
  | "permissive"
  | "consensus"
  | "wordlist"
  | "freeapi";

const SWDICT_SUFFIX = ".swdict";

export class PlayRejectedError extends Error {
  constructor(message: string) {
    super(t("error.play_rejected.play_rejected", { message }));
    this.name = "PlayRejected";
  }
}

type DictionarySettings = {
  dictionaryType: DictionaryType;
  dictionarySettings: any;
  baseUrl: string;
}

export function makeDictionary(settings: DictionarySettings) {
  // TODO(#95): Support 'consensus' type.
  if (settings.dictionaryType === "permissive")
    return new PermissiveDictionary;
  if (settings.dictionaryType === "wordlist")
    return new ListDictionary(settings);
  if (settings.dictionaryType === "freeapi") {
    let urlTemplate!: string, dictionaryName!: string;
    if (settings.dictionarySettings) {
      if (typeof settings.dictionarySettings !== "string") {
        throw new Error(
          `Dictionary type "${settings.dictionaryType}" requires setting a URL template.`,
        );
      }
      urlTemplate = settings.dictionarySettings;
      dictionaryName = settings.dictionarySettings;
    } else {
      urlTemplate = "https://api.dictionaryapi.dev/api/v2/entries/en/{lower}";
      dictionaryName = "Free Dictionary API";
    }
    return new UrlTemplateDictionary(urlTemplate, dictionaryName);
  }
  throw new Error(
    `dictionaryType ${settings.dictionaryType} is not supported.`,
  );
}

class WordNotInDictionaryError extends PlayRejectedError {
  constructor(
    readonly word: string,
    readonly dictionaryName: string,
    readonly status: string,
  ) {
    super(
      t("error.play_rejected.word_not_in_dictionary", {
        word,
        status,
        dictionaryName,
      }),
    );
    this.name = "WordNotInDictionaryError";
  }
}

class WordNotFoundError extends WordNotInDictionaryError {
  constructor(word: string, dictionaryName: string) {
    super(word, dictionaryName, t("error.play_rejected.status.not_found"));
    this.name = "WordNotFoundError";
  }
}

class NoDefinitionError extends WordNotInDictionaryError {
  constructor(word: string, dictionaryName: string) {
    super(
      word,
      dictionaryName,
      t("error.play_rejected.status.has_no_definition"),
    );
    this.name = "NoDefinitionError";
  }
}

class PermissiveDictionary extends Dictionary {
  override checkWords(...possibleWords: Array<string>) {}
};

class UrlTemplateDictionary extends Dictionary {
  constructor(
    private readonly urlTemplate: string,
    private readonly dictionaryName: string,
  ) {
    super();
  }

  override async checkWords(...words: Array<string>) {
    const promises: Array<Promise<WordNotInDictionaryError | null>> = words.map(
      (word) => {
        const url = this.urlTemplate.replace("{lower}", word.toLowerCase());
        return checkWordUsingUrl(word, url, this.dictionaryName);
      },
    );
    const results = await Promise.all(promises);
    const errors = results.filter((r) => r);
    if (errors.length === 0) return; // Words accepted.
    if (errors.length === 1) throw errors[0];
    const invalidWords = errors.map((wnidError) => wnidError!.word);
    throw new PlayRejectedError(
      t("error.play_rejected.not_words_in_dictionary", {
        dictionaryName: errors[0]!.dictionaryName,
        invalidWords: invalidWords.join(", "),
      }),
    );
  }
}

/**
 * @returns null if the word is valid.
 * @returns {WordNotInDictionaryError} if `wordToCheck` is not a word according to the dictionary.
 * @throws {Error} on failure to check the word.
 */
async function checkWordUsingUrl(
  wordToCheck: string,
  url: string,
  dictionaryName: string,
) {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      if (response.status === 404) {
        return new WordNotFoundError(wordToCheck, dictionaryName);
      } else {
        throw new Error(
          `Error validating word "${wordToCheck}" with ${dictionaryName} (Status: ${response.status} ${response.statusText}).`,
        );
      }
    }
    const data = await response.json();
    if (
      !Array.isArray(data) ||
      data.length === 0 ||
      (data[0] && data[0].title === "No Definitions Found")
    ) {
      return new NoDefinitionError(wordToCheck, dictionaryName);
    }
    // TODO: Reject words defined only as abbreviations.
    console.log(
      `Word "${wordToCheck}" is valid according to ${dictionaryName}.`,
    );
    return null; // Word accepted.
  } catch (error) {
    console.error(
      `Network or other error validating word "${wordToCheck}":`,
      error,
    );
    throw new Error(
      `Could not reach ${dictionaryName} to validate "${wordToCheck}". Check connection or API status.`,
    );
  }
}

class ListDictionary extends Dictionary {
  private readonly dictionaryId: string;
  private wordListPromise: Promise<WordList> | null = null;
  private wordList: WordList | null = null;

  constructor(private readonly settings: DictionarySettings) {
    super();
    const dictionarySettings = settings.dictionarySettings;
    if (typeof dictionarySettings !== "string") {
      throw new TypeError(
        `Word list requires a string URL, not ${dictionarySettings}.`,
      );
    }
    this.dictionaryId = dictionarySettings;
  }

  private getWordList() {
    if (!this.wordListPromise) {
      let dictionaryUrl: string;
      try {
        dictionaryUrl = new URL(this.dictionaryId).href;
        // `this.dictionaryId` is an absolute URL.
      } catch (e: any) {
        if (!(e instanceof TypeError)) throw e;
        // `this.dictionaryId` is a relative URL or simple identifier.
        const maybeSuffix =
          this.dictionaryId.slice(-SWDICT_SUFFIX.length) === SWDICT_SUFFIX
            ? ""
            : SWDICT_SUFFIX;
        const relativeUrl = this.dictionaryId + maybeSuffix;
        dictionaryUrl = new URL(relativeUrl, new URL("dict/", this.settings.baseUrl))
          .href;
      }
      this.wordListPromise = (async () => {
        const response = await fetch(dictionaryUrl);
        if (!response.ok) {
          throw new Error(
            `Failed to fetch word list from ${dictionaryUrl}: ${response.statusText}`,
          );
        }
        const buffer = await response.arrayBuffer();
        return new WordList(new Uint8Array(buffer));
      })();
    }
    return this.wordListPromise;
  }

  private async checkWordsAsync(...words: Array<string>): Promise<void> {
    this.wordList = await this.getWordList();
    return this.checkWords(...words);
  }

  override checkWords(...words: Array<string>) {
    if (!this.wordList) {
      return this.checkWordsAsync(...words);
    }

    const wordList = this.wordList;
    const dictionaryName = wordList.metadata?.name || this.dictionaryId;
    const errors = words
      .map((word) => {
        if (!wordList.has(word.toLowerCase())) {
          return new WordNotFoundError(word, dictionaryName);
        }
        return null;
      })
      .filter((r): r is WordNotFoundError => r !== null);

    if (errors.length === 0) return;
    if (errors.length === 1) throw errors[0];

    const invalidWords = errors.map((e) => e.word);
    throw new PlayRejectedError(
      t("error.play_rejected.not_words_in_dictionary", {
        dictionaryName,
        invalidWords: invalidWords.join(", "),
      }),
    );
  }
}
