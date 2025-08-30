# es.fw2018.st.50k

* 50k palabras frecuentes en español sin tilde en las vocales
* 50k frequent Spanish words with accent marks removed from vowels

## Source of es.fw2018.st.50k

* Here `../FrequencyWords` is a clone of https://github.com/hermitdave/FrequencyWords.git.

### Bash script

```shell
perl -Mstrict -wnle '
  tr/áéíóúü/aeiouu/;           # Strip diacritics from vowels.
  my ($word, $frequency) = /^(.*?)\s+(\d+)/u;  # Parse the line.
  next if length($word) < 2;   # Filter out single-letter words.
  next if length($word) == 2 && $word !~ /
    # Filter out two-letter non-words.
    ah | aj | al | ar | as | ay |
    be | bu | ce | cu | da | de | di | do |
    ea | eh | el | en | es | ex | ey |
    fa | fe | fo | fu | ge | ha | he |
    id | ir |
    ja | je | ji | ju | ka | la | le | lo |
    me | mi | mu | ni | no | ñu |
    oa | oc | oh | os | ox |
    pe | pi | pu | re | ro | se | so | su | ta | te | ti | to | tu |
    uf | uh | un |
    va | ve | vi | xi | ya | ye | yo | za
  /xu;
  next if $word =~ /^(         # Filter out some short non-words.
    mau | joe | oau | you | ray | dao | sir | ted | doc |
    mac | eva | roy | jay | ios | ian | lou | aoi | sue |
    liz | gus | vau | zoe | jin | von | dau
  )$/xu;
  next if length($word) == 3 && $frequency < 5600 && $word !~ /
    # Filter out all but a few of the less common three-letter sequences.
    lea | ave | ola | aca | can | oir | jan | pis | ego |
    bus | rio | chi | are | une | val | cha | gol | eco |
    ava | ajo | rol | tos | ame | tia | pro | zoo | ire |
    che | vil | bon | zar | tac | eje | ano | tic | gin |
    jai | pos | per | uva | aro | len | faz | non | fez |
    tao | too | osa | yen | lei | ata
  /xu;
  next if $word =~ /[^a-zñ]/;  # Filter out punctuation etc.
  next if $word !~ /           # Filter out most foreign and irregular words.
    ^(
      y
    |
      ( kas? | kappas? | kelvins? | zetas? )
    |
      (
        ^( anti | ex | post )(?=.)
      |
        ^kilo
      |
        (
          (
            ([dhjlmnrsv]|ñ|[bcfgp][lr]?|ch|(ll|y)(?!i[aeou])|qu(?=e|i(?![iy]))|x(?=[ei])|[dt]r?|z(?=[aou]))
            (u(?!u)|i(?!i))?
          )?
          (a(?!aa)|e(?!ee)|i(?!i)|o(?!oo)|u(?!u))
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
    --top-n=50k \
    -o dict/es.fw2018.st.50k.swdict \
    --name="Español FrequencyWords 50k" \
    --description="$(< dict/es.fw2018.st.50k.md)"
```
