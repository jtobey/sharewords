# 10,000 frequent, playable English words

## Source of en.linux-10k.swdict

* `/usr/share/dict/linux.words` is from Cygwin's words-3.0.1 package.
* `../FrequencyWords` is from https://github.com/hermitdave/FrequencyWords.

### Bash script

```shell
# Copyright 2025 Google LLC
# SPDX-License-Identifier: Apache-2.0
egrep '^[a-z][a-z]+$' /usr/share/dict/linux.words > dict/en.linux.sharewords~
bun run dict/dictc.ts \
    -i dict/en.linux.sharewords~ \
    --top-n=10k \
    --frequencies-file ../FrequencyWords/content/2018/en/en_50k.txt \
    -o dict/en.linux-10k.swdict \
    --language-code=en \
    --name="Cygwin English 10k" \
    --description="$(< dict/en.linux-10k.md)"
```

### Copyright status unclear

The word list created as an intermediate file by the above script may be from
the first edition of the Official Scrabble Players Dictionary. See en.linux.md
for more information.
