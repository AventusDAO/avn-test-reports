'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

function run(cmd, cwd) {
  execSync(cmd, { cwd, stdio: 'inherit' });
}

function safeTimestamp() {
  // e.g. 2026-01-12T18_04_33 (UTC; sortable)
  return new Date().toISOString().split('.')[0].replaceAll(':', '_');
}

function parseTimestampFromFilename(filename) {
  // expects: YYYY-MM-DDTHH_MM_SS.html
  const m = filename.match(/^(\d{4}-\d{2}-\d{2}T\d{2}_\d{2}_\d{2})\.html$/);
  if (!m) return null;

  const isoish = m[1].replaceAll('_', ':'); // YYYY-MM-DDTHH:MM:SS
  const d = new Date(`${isoish}Z`); // safeTimestamp() is UTC
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

function listTimestampedReports(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter(f => f.endsWith('.html') && f !== 'index.html')
    .map(f => ({ file: f, date: parseTimestampFromFilename(f) }))
    .filter(x => x.date)
    .sort((a, b) => b.date - a.date); // newest first
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

  for (const r of toDelete) {
    fs.unlinkSync(path.join(dir, r.file));
  }

  if (toDelete.length) {
    console.log(`🧹 Deleted ${toDelete.length} report(s) older than ${retainDays} day(s) (cutoff: ${cutoff.toISOString()}):`);
    console.log(`   ${toDelete.map(r => r.file).join(', ')}`);
  } else {
    console.log(`✅ No reports older than ${retainDays} day(s) to delete (cutoff: ${cutoff.toISOString()}).`);
  }
}

function prettyNameFromFilename(file) {
  // 2026-01-19T14_03_22.html -> 2026-01-19 14:03:22 UTC
  const d = parseTimestampFromFilename(file);
  if (!d) return file;
  return d.toISOString().replace('T', ' ').replace('Z', ' UTC');
}

function writeChainIndex(targetDir, suite, chain, retainDays) {
  const reports = listTimestampedReports(targetDir); // newest first

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

  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${suite} • ${chain} • Reports</title>
  <style>
    :root{
      --bg:#0b1220;
      --text:#eaf0ff;
      --muted:#a8b3d6;
      --line:rgba(255,255,255,.10);
      --accent:#7aa2ff;
      --shadow: 0 10px 30px rgba(0,0,0,.35);
      --radius: 16px;
      --good:#2dd4bf;
    }
    *{ box-sizing:border-box; }
    body{
      margin:0;
      font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial;
      background: radial-gradient(1200px 800px at 20% 0%, #162652 0%, var(--bg) 55%) fixed;
      color: var(--text);
    }
    .container{ max-width:1100px; margin:0 auto; padding:28px 18px 60px; }
    .header{
      display:flex; gap:16px; align-items:flex-end; justify-content:space-between; flex-wrap:wrap;
      padding:18px 18px 22px;
      border:1px solid var(--line);
      border-radius: var(--radius);
      background: linear-gradient(180deg, rgba(255,255,255,.06), rgba(255,255,255,.02));
      box-shadow: var(--shadow);
    }
    h1{ margin:0; font-size:24px; letter-spacing:.2px; }
    .subtitle{ margin:6px 0 0; color:var(--muted); line-height:1.35; font-size:14px; }
    .pill{
      display:inline-flex; align-items:center; gap:10px;
      padding:10px 12px;
      border:1px solid var(--line);
      border-radius:999px;
      background: rgba(0,0,0,.18);
      color: var(--muted);
      font-size: 13px;
      white-space:nowrap;
    }
    .dot{ width:9px;height:9px;border-radius:999px;background:var(--good); box-shadow:0 0 0 3px rgba(45,212,191,.15); }

    .chain-list{ margin-top:18px; display:flex; flex-direction:column; gap:10px; padding:0; list-style:none; }
    .row{
      display:flex; align-items:center; justify-content:space-between; gap:12px;
      padding:12px 12px;
      border:1px solid var(--line);
      border-radius:12px;
      background: rgba(0,0,0,.16);
    }
    .row-left{ display:flex; flex-direction:column; gap:2px; min-width: 170px; }
    .row-title{ font-weight:700; font-size:14px; letter-spacing:.2px; }
    .row-sub{ color: var(--muted); font-size:12px; }
    .actions{ display:flex; gap:10px; flex-wrap:wrap; justify-content:flex-end; }
    .btn{
      display:inline-flex; align-items:center; gap:8px;
      padding:10px 12px;
      border-radius:12px;
      border:1px solid var(--line);
      background: rgba(122,162,255,.12);
      text-decoration:none;
      font-size: 13px;
      font-weight: 700;
      color: var(--text);
    }
    .btn:hover{ background: rgba(122,162,255,.18); }
    .badge{
      display:inline-flex;
      align-items:center;
      padding:3px 8px;
      margin-left:8px;
      border-radius:999px;
      border:1px solid var(--line);
      color: var(--muted);
      background: rgba(0,0,0,.18);
      font-size: 12px;
      font-weight: 600;
      vertical-align: middle;
    }
    code{
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
      background: rgba(255,255,255,.06);
      padding: 2px 6px;
      border-radius: 8px;
      border:1px solid var(--line);
      color: var(--text);
      font-size: 12px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div>
        <h1>${suite} • ${chain}</h1>
        <p class="subtitle">
          Report history (newest first). Files older than <code>${retainDays}</code> day(s) are automatically removed.
        </p>
      </div>
      <div class="pill" title="GitHub Pages hosted">
        <span class="dot"></span>
        <a class="btn" style="padding:8px 10px" href="../../index.html">← Back</a>
      </div>
    </div>

    <ul class="chain-list">
      ${itemsHtml || emptyHtml}
    </ul>
  </div>
</body>
</html>`;

  fs.writeFileSync(path.join(targetDir, 'index.html'), html);
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
  if (!fs.existsSync(absReportPath)) {
    throw new Error(`Report not found at: ${absReportPath}`);
  }

  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'avn-test-reports-'));
  const repoUrl = `https://${token}@github.com/${repo}.git`;

  console.log(`📥 Cloning ${repo} (${branch})...`);
  run(`git clone --branch ${branch} ${repoUrl} .`, workDir);

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

  const baseUrl = `https://${repo.split('/')[0].toLowerCase()}.github.io/${repo.split('/')[1]}/${suite}/${chain}`;
  console.log(`✅ Published run: ${baseUrl}/${tsFile}`);
  console.log(`✅ Chain index: ${baseUrl}/`);

  return { tsFile, baseUrl, chainIndexUrl: `${baseUrl}/` };
}

module.exports = { publishReport };
