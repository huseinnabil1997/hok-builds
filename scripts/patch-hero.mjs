// Pakai: node scripts/patch-hero.mjs <slug...>  -> sisipkan panel Build Pro KPL ke heroes/<slug>.html
import fs from "fs";
for (const slug of process.argv.slice(2)) {
  const p = `heroes/${slug}.html`; let s = fs.readFileSync(p, "utf8");
  if (s.includes('id="pro-builds"')) continue;
  s = s.replace('<section class="spell-panel"', `<section class="pro-panel" id="pro-builds" data-slug="${slug}"></section>\n<section class="spell-panel"`);
  if (!s.includes('id="pro-builds"')) throw new Error("spell-panel tidak ada: " + slug);
  s = s.replace(/css\/style\.css\?v=\w+/, "css/style.css?v=20261015p");
  s = s.replace("</body>", '  <script src="../data/pro-builds.js?v=20261015p"></script>\n  <script src="../js/pro-builds.js?v=20261015p"></script>\n</body>');
  fs.writeFileSync(p, s);
}
