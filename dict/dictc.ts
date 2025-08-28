import { parseArgs } from 'util'
import * as fs from 'fs'
import * as readline from 'readline'
import { compile } from './compiler.js'
import { Lexicon } from './swdict.js'

const { values: args } = parseArgs({
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
    'top-n': {
      // Optional limit on most frequent words. A number with optional 'k' (thousand) suffix.
      type: 'string',
    },
    output: {
      // Name of the swdict file to create.
      type: 'string',
      short: 'o',
    },
    name: {
      // Display name to embed in the output.
      type: 'string',
    },
    description: {
      // Descriptive text or markdown to embed in the output.
      type: 'string',
    },
  },
  strict: true,
});

const wordsFile = args['words-file']
const frequenciesFile = args['frequencies-file'] || wordsFile
const topN = parseTopNArg(args['top-n'])
const outputFile = args.output
const name = args.name
const description = args.description

function parseTopNArg(nStr: string | undefined) {
  if (!nStr) return Infinity
  const match = nStr.match(/^(\d+)(k?)$/)
  if (!match) throw new Error('Invalid `-n` number: ' + `"${nStr}"`)
  return parseInt(match[1]!, 10) * (match[2]! ? 1000 : 1)
}

if (!wordsFile) throw new Error('No `--words-file` specified.')
if (!outputFile) throw new Error('No `--output` specified.')
if (name === undefined) throw new Error('No `--name` specified.')
if (description === undefined) throw new Error('No `--description` specified.')

function readFileLines(fileName: string): AsyncIterable<string> {
  const inputStream = fs.createReadStream(fileName)
  return readline.createInterface({
    input: inputStream,
    crlfDelay: Infinity,  // Recognizes both '\n' and '\r\n' as line breaks
  })
}

async function* parseWords(lines: AsyncIterable<string>): AsyncIterable<string> {
  for await (const line of lines) {
    const match = line.match(/(?:^|\s)(?<word>\p{Letter}+)\b/u)
    if (match) yield match.groups!.word!
  }
}

async function* parseFrequencies(lines: AsyncIterable<string>): AsyncIterable<[string, number]> {
  for await (const line of lines) {
    const match = line.match(/(?:^|\s)(?<word>\p{Letter}+)\s+(?<frequency>\d+(?:,\d{3})*(?:\.\d+)?)\b/u)
    if (match) {
      yield [
        match.groups!.word!,
        parseFloat(match.groups!.frequency!.replaceAll(',', '')),
      ]
    }
  }
}

async function parseWordsAndFrequenciesMap(wordsFile: string, frequenciesFile?: string): Promise<{
  words: AsyncIterable<string> | Iterable<string>
  frequenciesMap: Map<string, number> | null
}> {
  let words: AsyncIterable<string> | Iterable<string> | null = null
  let frequenciesMap: Map<string, number> | null = null
  if (topN < Infinity) {
    const wordsWithFrequencies = parseFrequencies(readFileLines(frequenciesFile || wordsFile))
    frequenciesMap = new Map<string, number>
    for await (const [word, frequency] of wordsWithFrequencies) {
      frequenciesMap.set(word, frequency + (frequenciesMap.get(word) ?? 0))
    }
    if (frequenciesFile === wordsFile || !frequenciesFile) {
      words = frequenciesMap.keys()
    }
  }
  if (!words) {
    words = parseWords(readFileLines(wordsFile))
  }
  return { words, frequenciesMap }
}

async function filterByFrequency({ words, topN, frequenciesMap } : {
  words: AsyncIterable<string> | Iterable<string>
  topN: number
  frequenciesMap: Map<string, number> | null
}): Promise<AsyncIterable<string> | Iterable<string>> {
  if (topN === Infinity) return words
  if (!frequenciesMap) {
    throw new Error('`--top-n` requires `--frequencies-file`.')
  }
  // This map may not equal `frequenciesMap` if the words in the frequencies file
  // differ from those in the words file.
  const wordsWithFrequenciesMap = new Map<string, number>
  for await (const word of words) {
    if (!wordsWithFrequenciesMap.has(word)) {
      const frequency = frequenciesMap.get(word)
      if (frequency !== undefined) {
        wordsWithFrequenciesMap.set(word, frequency)
      }
    }
  }
  const wordsWithFrequencies = [...wordsWithFrequenciesMap.entries()]
  wordsWithFrequencies.sort(([wordA, frequencyA], [wordB, frequencyB]) => frequencyB - frequencyA)
  const topWordsWithFrequencies = wordsWithFrequencies.slice(0, topN)
  // console.log(topWordsWithFrequencies)
  return topWordsWithFrequencies.map(([word, frequency]) => word)
}

async function dictc({ wordsFile, frequenciesFile, topN, outputFile, name, description }: {
  wordsFile: string
  frequenciesFile?: string
  topN: number
  outputFile: string
  name: string
  description: string
}) {
  const { words: allWords, frequenciesMap } = await parseWordsAndFrequenciesMap(wordsFile, frequenciesFile)
  const words = await filterByFrequency({ words: allWords, topN, frequenciesMap })
  const lexicon = await compile({ words, name, description })
  fs.writeFileSync(outputFile, Lexicon.encode(lexicon).finish())
}

dictc({ wordsFile, frequenciesFile, topN, outputFile, name, description })
