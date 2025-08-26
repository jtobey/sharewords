import { parseArgs } from 'util'
import * as fs from 'fs'
import * as readline from 'readline'
import { compile } from './compiler.js'
import { Lexicon } from './dict.js'

const { values } = parseArgs({
  args: Bun.argv.slice(2),
  options: {
    'words-file': {
      type: 'string',
      short: 'i',
    },
    output: {
      type: 'string',
      short: 'o',
    },
    name: {
      type: 'string',
      short: 'n',
    },
    description: {
      type: 'string',
      short: 'd',
    },
  },
  strict: true,
});

if (!values['words-file']) throw new Error('No `--words-file` specified.')
if (!values.output) throw new Error('No `--output` specified.')
if (!values.name) throw new Error('No `--name` specified.')
if (!values.description) throw new Error('No `--description` specified.')

const inputStream = fs.createReadStream(values['words-file'])

const words = readline.createInterface({
  input: inputStream,
  crlfDelay: Infinity,  // Recognizes both '\n' and '\r\n' as line breaks
})

const lexicon = await compile({
  words,
  name: values.name,
  description: values.description,
})

fs.writeFileSync(values.output, Lexicon.encode(lexicon).finish())
