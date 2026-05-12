#!/bin/bash

# Load nvm
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

# Use Node version from .nvmrc if it exists, otherwise use default
if [ -f .nvmrc ]; then
    nvm install
    nvm use
else
    nvm use default
fi

# Run dev server
npm run dev
