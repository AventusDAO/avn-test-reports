'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');
const { chainIndexHtml } = require('./chainIndexTemplate');

function run(cmd, cwd) {
  execSync(cmd, { cwd, stdio: 'inherit' });
}

function safeTimestamp() {
  return new Date().toISOString().split('.')[0].replaceAll(':', '_');
}

function parseTimestampFromFilename(filename) {
  const m = filename.match(/^(\d{4}-\d{2}-\d{2}T\d{2}_\d{2}_\d{2})\.html$/);
  if (!m) return null;

  const isoish = m[1].replaceAll('_', ':');
  const d = new Date(`${isoish}Z`);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

function listTimestampedReports(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter(f => f.endsWith('.html') && f !== 'index.html')
    .map(f => ({ file: f, date: parseTimestampFromFilename(f) }))
    .filter(x => x.date)
    .sort((a, b) => b.date - a.date);
}

function pruneByAge(dir, retainDays) {
  if (!retainDays || retainDays <= 0) {
    console.log('ℹ️ Retention disabled (retainDays <= 0). Not deleting any old reports.');
    return;
  }

  const cutoffMs = Date.now() - (retainDays * 24 * 60 * 60 * 1000);
  const cutoff = new Date(cutoffMs);

  const reports = listTimestampedReports(dir);
  const toDelete = reports.filter(r => r.date < cutoff);

  for (const r of toDelete) fs.unlinkSync(path.join(dir, r.file));

  if (toDelete.length) {
    console.log(`🧹 Deleted ${toDelete.length} report(s) older than ${retainDays} day(s) (cutoff: ${cutoff.toISOString()}):`);
    console.log(`   ${toDelete.map(r => r.file).join(', ')}`);
  } else {
    console.log(`✅ No reports older than ${retainDays} day(s) to delete (cutoff: ${cutoff.toISOString()}).`);
  }
}

function prettyNameFromFilename(file) {
  const d = parseTimestampFromFilename(file);
  if (!d) return file;
  return d.toISOString().replace('T', ' ').replace('Z', ' UTC');
}

function writeChainIndex(targetDir, suite, chain, retainDays) {
  const reports = listTimestampedReports(targetDir);

  const itemsHtml = reports.map((r, idx) => {
    const label = prettyNameFromFilename(r.file);
    const badge = idx === 0 ? `<span class="badge">Newest</span>` : '';
    return `
      <li class="row">
        <div class="row-left">
          <div class="row-title">${label} ${badge}</div>
          <div class="row-sub">${r.file}</div>
        </div>
        <div class="actions">
          <a class="btn" href="./${r.file}">Open report</a>
        </div>
      </li>
    `;
  }).join('\n');

  const emptyHtml = `
    <li class="row">
      <div class="row-left">
        <div class="row-title">No reports yet</div>
        <div class="row-sub">Run the publisher to add reports.</div>
      </div>
    </li>
  `;

  const html = chainIndexHtml({ suite, chain, retainDays, itemsHtml, emptyHtml });
  fs.writeFileSync(path.join(targetDir, 'index.html'), html);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function publishReport(opts) {
  const {
    suite,
    chain,
    token,
    reportPath,
    retainDays = 30,
    repo = 'AventusDAO/avn-test-reports',
    branch = 'gh-pages',
  } = opts || {};

  if (!suite) throw new Error('Missing required option: suite');
  if (!chain) throw new Error('Missing required option: chain');
  if (!token) throw new Error('Missing required option: token (or set GITHUB_TOKEN env var)');
  if (!reportPath) throw new Error('Missing required option: reportPath');
  if (typeof retainDays !== 'number' || Number.isNaN(retainDays) || retainDays < 0) {
    throw new Error(`Invalid retainDays: ${retainDays} (must be a number >= 0)`);
  }

  const absReportPath = path.resolve(process.cwd(), reportPath);
  if (!fs.existsSync(absReportPath)) throw new Error(`Report not found at: ${absReportPath}`);

  process.env.GIT_TERMINAL_PROMPT = '0';
  const cleanToken = String(token).trim();
  if (!cleanToken) throw new Error('Token is empty after trimming (check Jenkins credential value).');

  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'avn-test-reports-'));
  const repoUrl = `https://x-access-token:${cleanToken}@github.com/${repo}.git`;

  console.log(`📥 Cloning ${repo} (${branch})...`);
  run(`git clone --branch ${branch} ${repoUrl} .`, workDir);

  run(`git remote set-url origin ${repoUrl}`, workDir);
  run(`git config --local credential.helper ""`, workDir);

  const targetDir = path.join(workDir, suite, chain);
  fs.mkdirSync(targetDir, { recursive: true });

  const tsFile = `${safeTimestamp()}.html`;
  fs.copyFileSync(absReportPath, path.join(targetDir, tsFile));

  pruneByAge(targetDir, retainDays);
  writeChainIndex(targetDir, suite, chain, retainDays);

  run(`git config user.email "ci@aventus.io"`, workDir);
  run(`git config user.name "Aventus CI"`, workDir);

  run(`git add ${suite}/${chain}`, workDir);

  try {
    run(`git commit -m "Publish ${suite}/${chain} report ${tsFile} (retainDays=${retainDays})"`, workDir);
  } catch (e) {
    console.log('ℹ️ No changes to commit (report identical and no deletions).');
  }

  console.log(`🚀 Pushing to ${branch}...`);
  run(`git push origin ${branch}`, workDir);

  console.log('⏳ Waiting 60 seconds for GitHub Pages to update...');
  await sleep(60_000);

  const baseUrl = `https://${repo.split('/')[0].toLowerCase()}.github.io/${repo.split('/')[1]}/${suite}/${chain}`;
  console.log(`✅ Published run: ${baseUrl}/${tsFile}`);
  console.log(`✅ Chain index: ${baseUrl}/`);

  return { tsFile, baseUrl, chainIndexUrl: `${baseUrl}/` };
}

module.exports = { publishReport };
