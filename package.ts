// Script that packages the game into one HTML file (printed to stdout).

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

const bunBuiltHtml = await getText('./index.html')
const inlined = bunBuiltHtml.replace(
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
