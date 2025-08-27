# Circa 113,000 playable English words

## Source of linux.sharewords and linux.swdict

* `/usr/share/dict/linux.words` is from Cygwin's words-3.0.1 package.

### Bash script

```shell
egrep '^[a-z][a-z]+$' /usr/share/dict/linux.words > dict/linux.sharewords
bun run dict/dictc.ts \
    --words-file=dict/linux.sharewords \
    --output=dict/linux.swdict \
    --name="Cygwin English" \
    --description="$(< dict/linux.md)"
```
