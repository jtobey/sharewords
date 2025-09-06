# 264,097 playable English words

## Source of en.yawl.swdict

* Here `../yawl` is a clone of https://github.com/elasticdog/yawl.git.

### Bash script

```shell
# Copyright 2025 Google LLC
# SPDX-License-Identifier: Apache-2.0
bun run dict/dictc.ts \
    -i ../yawl/yawl-0.3.2.03/word.list \
    -o dict/en.yawl.swdict \
    --language-code=en \
    --name="English YAWL" \
    --description="$(< dict/en.yawl.md)"
```

### Copying

https://github.com/elasticdog/yawl asserts that the YAWL list is in the public
domain.
