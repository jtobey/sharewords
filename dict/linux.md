# Circa 113,000 playable English words

## Source of linux.swdict

* `/usr/share/dict/linux.words` is from Cygwin's words-3.0.1 package.

### Bash script

```shell
egrep '^[a-z][a-z]+$' /usr/share/dict/linux.words > dict/linux.sharewords~
bun run dict/dictc.ts \
    -i dict/linux.sharewords~ \
    -o dict/linux.swdict \
    --name="Cygwin English" \
    --description="$(< dict/linux.md)"
```
