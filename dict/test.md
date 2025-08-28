# Test Dictionary

This is a test dictionary for development purposes.

## Source of test.swdict

`test.words` contains a small list of English words for testing.

### Bash script

```shell
bun run dict/dictc.ts \
    -i dict/test.words \
    -o dict/test.swdict \
    --name="Test Dictionary" \
    --description="$(< dict/test.md)"
```
