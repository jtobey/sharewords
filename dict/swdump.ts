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
import * as fs from "fs";
import { parseArgs } from "util";
import { Lexicon } from "./swdict.js";
import { WordList } from "./word_list.js";

const { values: args, positionals: dictFiles } = parseArgs({
  args: Bun.argv.slice(2),
  options: {
    "show-name": {
      // Print the word list name.
      type: "boolean",
      short: "n",
    },
    "show-description": {
      // Print the word list description.
      type: "boolean",
      short: "d",
    },
    "show-language-codes": {
      // Print the word list description.
      type: "boolean",
      short: "l",
    },
    "show-frequencies": {
      // Print the subword (letter) frequencies.
      type: "boolean",
      short: "f",
    },
    "show-word-count": {
      // Print the word list.
      type: "boolean",
      short: "c",
    },
    "show-words": {
      // Print the word list.
      type: "boolean",
      short: "w",
    },
    "show-metadata": {
      // Print all metadata.
      type: "boolean",
      short: "m",
    },
    "show-all": {
      type: "boolean",
      short: "a",
    },
  },
  strict: true,
  allowPositionals: true,
});

const showAll = args["show-all"];
const showMetadata = showAll || args["show-metadata"];
const showName = showMetadata || args["show-name"];
const showDescription = showMetadata || args["show-description"];
const showLanguageCodes = showMetadata || args["show-language-codes"];
const showFrequencies = showMetadata || args["show-frequencies"];
const showWordCount = showMetadata || args["show-word-count"];
const showWords =
  showAll ||
  (args["show-words"] ??
    !(
      showName ||
      showDescription ||
      showLanguageCodes ||
      showFrequencies ||
      showWordCount
    ));

for (const filePath of dictFiles) {
  const buffer = fs.readFileSync(filePath);
  const lexicon = Lexicon.decode(new Uint8Array(buffer));
  if (showName) console.log(lexicon.metadata?.name);
  if (showDescription) console.log(lexicon.metadata?.description);
  if (showLanguageCodes) console.log(lexicon.metadata?.languageCodes);
  if (showFrequencies) {
    for (const [
      subword,
      frequency,
    ] of lexicon.metadata?.subwordFrequencies?.entries() ?? []) {
      console.log(`${subword}: ${frequency}`);
    }
  }
  if (showWordCount) console.log(`Word Count: ${lexicon.metadata?.wordCount}`);
  if (showWords) {
    const wordList = new WordList(buffer);
    for (const word of wordList) {
      console.log(String(word));
    }
  }
}
