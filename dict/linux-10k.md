# 10,000 frequent, playable English words

## Source of linux-10k.sharewords and linux-10k.swdict

* `/usr/share/dict/linux.words` is from Cygwin's words-3.0.1 package.
* `../FrequencyWords` is from https://github.com/hermitdave/FrequencyWords.

### Bash script

```shell
egrep '^[a-z][a-z]+$' /usr/share/dict/linux.words > dict/linux.sharewords
bun run dict/topn.ts \
    -i dict/linux.sharewords \
    --frequencies-file ../FrequencyWords/content/2018/en/en_50k.txt \
    -o dict/linux-10k.sharewords \
    -n 10k
bun run dict/dictc.ts \
    --words-file=dict/linux-10k.sharewords \
    --output=dict/linux-10k.swdict \
    --name="Cygwin English 10k" \
    --description="$(< dict/linux-10k.md)"
```
