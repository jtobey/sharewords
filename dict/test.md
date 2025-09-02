# Test Dictionary

This is a test dictionary for development purposes.

## Source of test.swdict

`test.words` contains a small list of English words for testing.

### Bash script

```shell
# Copyright 2025 Google LLC
# SPDX-License-Identifier: Apache-2.0
bun run dict/dictc.ts \
    -i dict/test.words \
    -o dict/test.swdict \
    --name="Test Dictionary" \
    --description="$(< dict/test.md)"
```
