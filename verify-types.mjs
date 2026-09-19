#!/usr/bin/env node
// Run: node verify-types.mjs
// Uses child_process to run tsc and reports results
import { execSync } from 'child_process';
try {
  const result = execSync(
    'npx tsc --noEmit 2>&1',
    { cwd: '/Users/matthewalai/growthrig', env: { ...process.env, PATH: '/opt/homebrew/bin:' + process.env.PATH } }
  );
  console.log('TSC PASSED');
  console.log(result.toString());
} catch (e) {
  console.log('TSC FAILED:');
  console.log(e.stdout?.toString() || '');
  console.log(e.stderr?.toString() || '');
  process.exit(1);
}
