# Circa 113,000 playable English words

## Source of en.linux.swdict

* `/usr/share/dict/linux.words` is from Cygwin's words-3.0.1 package.

### Bash script

```shell
# Copyright 2025 Google LLC
# SPDX-License-Identifier: Apache-2.0
egrep '^[a-z][a-z]+$' /usr/share/dict/linux.words > dict/en.linux.sharewords~
bun run dict/dictc.ts \
    -i dict/en.linux.sharewords~ \
    -o dict/en.linux.swdict \
    --language-code=en \
    --name="Cygwin English" \
    --description="$(< dict/en.linux.md)"
```

### Copyright status unclear

The script removes single-letter words and capitalized words. The result
happens to be the same if you replace Cygwin's file with `113809of.fic` from
the package source. Package documentation points to
[Moby Project](https://en.wikipedia.org/wiki/Moby_Project) as the file's
source. The Wikipedia page does not mention that file name but lists another,
`CROSSWD.TXT`, having the same number of words as the script's output, and
described as "Words included in the first edition of the Official Scrabble
Players Dictionary".

Supposing that the words really are exactly those in the 1978 OSPD, is the
list in the public domain as the package documentation suggests? I am not a
lawyer. This is not legal advice. Possibly mere lists of words are not subject
to copyright.
