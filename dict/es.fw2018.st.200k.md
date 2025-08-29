# es.fw2018.st.200k

* 200k palabras frecuentes en español sin tilde en las vocales
* 200k frequent Spanish words with accent marks removed from vowels

## Source of es.fw2018.st.200k

* Here `../FrequencyWords` is a clone of https://github.com/hermitdave/FrequencyWords.git.

### Bash script

```shell
perl -nle '
  tr/áéíóúü/aeiouu/;           # Strip diacritics from vowels.
  my ($word, $frequency) = /^(.*?)\s+(\d+)/u;  # Parse the line.
  next if length(word) < 2;    # Filter out single-letter words.
  next if $word =~ /[^a-zñ]/;  # Filter out punctuation etc.
  next if $word !~ /           # Filter out most foreign and irregular words.
    ^(
      y
    |
      zetas?
    |
      (
        ^(anti|ex|post)(?=.)
      |
        ^kilo
      |
        (
          (
            ([dhjlmnrsv]|ñ|[bcfgp][lr]?|ch|(ll|y)(?!i[aeou])|qu(?=e|i(?![iy]))|x(?=[ei])|[dt]r?|z(?=[aou]))
            (u(?!u)|i(?!i))?
          )?
          ([aeo]|i(?!i)|u(?!u))
          (u(?!u)|i(?!i|$)|y$)?
          ([cdjlrsz]?|n(?![bp])|m(?=[bnp])|([bdn]s|x)(?=[tpc])|x(?=[haeiou])|b(?!$)|p(?=[cnst])|g(?=[mn])|t(?=[lmn])|[rn]s(?!$))
        )
      )+
    )$
  /xu;
  print;
  ' ../FrequencyWords/content/2018/es/es_full.txt > dict/es.fw2018.st.sharewords~
bun run dict/dictc.ts \
    -i dict/es.fw2018.st.sharewords~ \
    --top-n=200k \
    -o dict/es.fw2018.st.200k.swdict \
    --name="Español FrequencyWords 200k" \
    --description="$(< dict/es.fw2018.st.200k.md)"
```
