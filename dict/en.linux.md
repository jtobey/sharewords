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
