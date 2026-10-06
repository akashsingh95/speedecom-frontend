#!/usr/bin/env node

const { spawnSync } = require('child_process');

const files = process.argv.slice(2);

if (files.length === 0) {
  process.exit(0);
}

const result = spawnSync('npx', ['eslint', '--fix', '--max-warnings', '0', ...files], {
  stdio: 'inherit',
});

process.exit(result.status === 0 ? 0 : 1);
