# es.crea.st.123k

* 123k palabras frecuentes en español sin tilde en las vocales
* 123k frequent Spanish words with accent marks removed from vowels

## Source of es.crea.st.123k.swdict

* Here `../CREA_total.TXT` is one of the frequent word lists in ISO Latin 1 encoding from the Real Academia Española (https://corpus.rae.es/lfrecuencias.html)
  * Be sure to check with the copyright owner before publishing this data.

### Bash script

```shell
# Copyright 2025 Google LLC
# SPDX-License-Identifier: Apache-2.0
perl -nle '
  tr/\xE1\xE9\xED\xF3\xFA\xFC/aeiouu/;  # Strip diacritics from vowels.
  next if !/\s[a-z\xF1]{2,}\s/;         # Filter out single-letter words.
  next if !/[aeiou]/;                   # Filter out vowel-less words.
  s/\xF1/\xC3\xB1/g;                    # Convert ñ to UTF-8.
  print;
  ' ../CREA_total.TXT > dict/es.crea.st.sharewords~
bun run dict/dictc.ts \
    -i dict/es.crea.st.sharewords~ \
    --top-n=123k \
    -o dict/es.crea.st.123k.swdict \
    --language-code=es \
    --name="Español RAE 123k" \
    --description="$(< dict/es.crea.st.123k.md)"
```
