#!/usr/bin/env node
'use strict';

const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');
const { publishReport } = require('../src/publisher');

(async () => {
  const argv = yargs(hideBin(process.argv))
    .usage('avn-publish-report --suite functional --chain dev --reportPath ./finalReport.html\n\nToken can be passed via --token or env var GITHUB_TOKEN.')
    .option('suite', { type: 'string', demandOption: true })
    .option('chain', { type: 'string', demandOption: true })
    .option('reportPath', { type: 'string', demandOption: true })
    .option('retainDays', { type: 'number', default: 30 })
    .option('repo', { type: 'string', default: 'AventusDAO/avn-test-reports' })
    .option('branch', { type: 'string', default: 'gh-pages' })
    .option('token', { type: 'string', default: process.env.GITHUB_TOKEN })
    .check((a) => {
      if (!a.token) throw new Error('Missing --token (or set GITHUB_TOKEN env var)');
      return true;
    })
    .help()
    .argv;

  try {
    await publishReport(argv);
  } catch (err) {
    console.error(`❌ ${err?.message || err}`);
    process.exit(1);
  }
})();
