// Best-effort: mark links that aren't published yet (helps first-time setup).
// Once each chain folder has its own generated index.html, these checks are accurate.
(async function () {
    const links = Array.from(document.querySelectorAll("a[data-check]"));
    if (!links.length) return;
  
    let missing = 0;
  
    await Promise.all(
      links.map(async (a) => {
        try {
          const res = await fetch(a.getAttribute("href"), { method: "HEAD" });
          if (!res.ok) throw new Error("not ok");
        } catch (e) {
          missing++;
          const s = document.createElement("span");
          s.className = "status missing";
          s.textContent = " (not published yet)";
          a.after(s);
        }
      })
    );
  
    const status = document.getElementById("status");
    if (status) {
      status.textContent = missing
        ? `  •  ${missing} link(s) not published yet.`
        : `  •  All links look published.`;
    }
  })();
  