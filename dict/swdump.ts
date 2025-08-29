import * as fs from 'fs';
import { parseArgs } from 'util'
import { Lexicon } from './swdict.js'
import { WordList } from './word_list.js'

const { values: args, positionals: dictFiles } = parseArgs({
  args: Bun.argv.slice(2),
  options: {
    'show-name': {
      // Print the word list name.
      type: 'boolean',
      short: 'n',
    },
    'show-description': {
      // Print the word list description.
      type: 'boolean',
      short: 'd',
    },
    'show-words': {
      // Print the word list.
      type: 'boolean',
    },
    'show-all': {
      type: 'boolean',
      short: 'a',
    },
  },
  strict: true,
  allowPositionals: true,
});

const showAll = args['show-all']
const showName = showAll || args['show-name']
const showDescription = showAll || args['show-description']
const showWords = showAll || (args['show-words'] ?? !(showName || showDescription))

for (const filePath of dictFiles) {
  const buffer = fs.readFileSync(filePath);
  const lexicon = Lexicon.decode(new Uint8Array(buffer));
  if (showName) console.log(lexicon.metadata?.name)
  if (showDescription) console.log(lexicon.metadata?.description)
  if (showWords) {
    const wordList = new WordList(buffer)
    for (const word of wordList) {
      console.log(word)
    }
  }
}
