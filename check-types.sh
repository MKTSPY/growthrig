#!/bin/zsh
export PATH=/opt/homebrew/bin:$PATH
cd /Users/matthewalai/growthrig
npx --no-install tsc --noEmit 2>&1
echo "EXIT: $?"
