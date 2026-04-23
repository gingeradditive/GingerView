#!/bin/bash

# GingerView Development Runner
# This script loads nvm and uses Node.js 20 to run the development server

# Load nvm
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

# Use Node.js 20
nvm use 20

# Run development server
npm run dev
