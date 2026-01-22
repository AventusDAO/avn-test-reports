'use strict';

function chainIndexHtml({ suite, chain, retainDays, itemsHtml, emptyHtml }) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${suite} • ${chain} • Reports</title>

    <link rel="stylesheet" href="./chainIndex.css" />
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
}

module.exports = { chainIndexHtml };
