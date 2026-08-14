#!/usr/bin/env sh

# Configure this repo to use versioned hooks in .githooks.
if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  git config core.hooksPath .githooks
  echo "Git hooks path set to .githooks"
else
  echo "Not in a Git work tree. Skipping hooks setup."
fi
