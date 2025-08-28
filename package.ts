// Script that packages the game into one HTML file (printed to stdout).
import * as fs from 'fs';
import * as path from 'path';
import { Lexicon } from './dict/swdict.js';

const result = await Bun.build({entrypoints: ['./index.html']})
const byPath = new Map<string, string>

for (const artifact of result.outputs) {
  byPath.set(artifact.path, await artifact.text())
}

function getText(path: string) {
  const text = byPath.get(path)
  if (text === undefined) {
    throw new Error(`No ${path} among outputs: (${[...byPath.keys()]})`)
  }
  return text
}

// Find custom dictionaries
const dictDir = './dict';
const dictFiles = fs.readdirSync(dictDir).filter(file => file.endsWith('.swdict'));

const customDictOptions: string[] = [];
for (const file of dictFiles) {
    const filePath = path.join(dictDir, file);
    const buffer = fs.readFileSync(filePath);
    const lexicon = Lexicon.decode(new Uint8Array(buffer));
    if (lexicon.metadata?.name) {
        const dictId = path.basename(file, '.swdict');
        customDictOptions.push(`<option value="${dictId}">${lexicon.metadata.name}</option>`);
    }
}

const bunBuiltHtml = await getText('./index.html')

// Inject custom dictionary options
let processedHtml = bunBuiltHtml;
if (customDictOptions.length > 0) {
    const optionsString = '                ' + customDictOptions.join('\n                ');
    // Insert before the "custom" option.
    processedHtml = processedHtml.replace(
        /(<option value="custom")/,
        `${optionsString}\n                $1`
    );
}


const inlined = processedHtml.replace(
  /<link rel="stylesheet"(?: crossorigin)? href="(.+?)">/,
  (match, path) => {
    const css = getText(path)
    if (css.includes('</style>')) throw new Error(`${path} contains the close-style tag.`)
    return `<style>${css}</style>`
  }
).replace(
  /<script type="module"(?: crossorigin)? src="(.*?)"><\/script>/,
  (match, path) => {
    const js = getText(path)
    if (js.includes('</script>')) throw new Error(`${path} contains the close-script tag.`)
    return `<script type="module">${js}</script>`
  }
)
console.log(inlined)
