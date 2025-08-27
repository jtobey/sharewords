import { parseArgs } from 'util'
import * as fs from 'fs'
import * as process from 'process'
import * as readline from 'readline'

const { values } = parseArgs({
  args: Bun.argv.slice(2),
  options: {
    'words-file': {
      // File line format: <whitespace>? <word> (<whitespace> <chars>)?
      type: 'string',
      short: 'i',
    },
    'frequencies-file': {
      // File line format: <whitespace>? <word> <whitespace> <number> (<whitespace> <chars>)?
      // Defaults to `words-file`.
      type: 'string',
    },
    output: {
      // The top `n` words from `words-file`, one per line.
      type: 'string',
      short: 'o',
    },
    n: {
      // Optional. A number with optional 'k' (thousand) suffix.
      type: 'string',
      short: 'n',
    },
  },
  strict: true,
});

if (!values['words-file']) throw new Error('No `--words-file` specified.')
if (!values.output) throw new Error('No `--output` specified.')

const wordsFile = values['words-file']
const frequenciesFile = values['frequencies-file'] || wordsFile
const outputFile = values.output
const n = parseN(values.n)

function parseN(nStr: string | undefined) {
  if (!nStr) return Infinity
  const match = nStr.match(/^(\d+)(k?)$/)
  if (!match) throw new Error('Invalid `-n` number: ' + `"${nStr}"`)
  return parseInt(match[1]!, 10) * (match[2]! ? 1000 : 1)
}

function readFileLines(fileName: string): AsyncIterable<string> {
  const inputStream = fs.createReadStream(fileName)
  return readline.createInterface({
    input: inputStream,
    crlfDelay: Infinity,  // Recognizes both '\n' and '\r\n' as line breaks
  })
}

async function* parseFrequencies(lines: AsyncIterable<string>): AsyncIterable<[string, number]> {
  for await (const line of lines) {
    const match = line.match(/(?:^|\s)(?<word>\D+)\s+(?<frequency>\d+(?:,\d{3})*(?:\.\d+)?)\b/)
    if (match) {
      yield [
        match.groups!.word!,
        parseFloat(match.groups!.frequency!.replaceAll(',', '')),
      ]
    }
  }
}

const frequencies = new Map<string, number>
for await (const [word, frequency] of parseFrequencies(readFileLines(frequenciesFile))) {
  frequencies.set(word, frequency + (frequencies.get(word) ?? 0))
}

async function* parseWords(lines: AsyncIterable<string>): AsyncIterable<string> {
  for await (const line of lines) {
    const match = line.match(/(?:^|\s)(?<word>\D+)\b/)
    if (match) yield match.groups!.word!
  }
}

async function* pairFrequenciesWithWords(words: AsyncIterable<string>): AsyncIterable<[string, number]> {
  for await (const word of words) {
    const frequency = frequencies.get(word)
    if (frequency !== undefined) yield [word, frequency]
  }
}

const wordsWithFrequencies = await Array.fromAsync(pairFrequenciesWithWords(parseWords(readFileLines(wordsFile))))
wordsWithFrequencies.sort((a, b) => b[1] - a[1])

const outputStream = fs.createWriteStream(outputFile)
for (const [word] of wordsWithFrequencies.splice(0, n)) {
  outputStream.write(word + '\n')
}
