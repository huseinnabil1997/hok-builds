// Tes aturan skor duo/trio (aturan 2) untuk js/banpick-camp.js dan js/banpick.js. Pakai: node scripts/test-combo-score.mjs
import fs from "fs";
import vm from "vm";
let fail = 0;
for (const file of ["js/banpick-camp.js", "js/banpick.js"]) {
  const ctx = { window: {} }; vm.createContext(ctx); vm.runInContext(fs.readFileSync(file, "utf8"), ctx);
  const score = ctx.window.__comboScore;
  const same = (a, b) => a === b, nm = (s) => s;
  const run = (duos, team) => {
    const duo = (a, b) => duos[[a, b].sort().join("+")] || 0;
    return score("A", team, duo, [{ v: 2, others: ["B", "C"] }], same, nm, "").total;
  };
  const cases = [
    [{ "A+C": 1 }, ["B"], 1, "duo A-C=1, trio=2, tim {B} -> trio x0,5"],
    [{ "A+C": 1 }, ["C"], 1, "tim {C} -> duo"],
    [{ "A+C": 1 }, ["B", "C"], 2, "tim {B,C} -> trio saja"],
    [{ "A+B": 1, "A+C": 1 }, ["B", "C"], 2, "duo A-B=1, A-C=1, trio=2, tim {B,C}"],
  ];
  for (const [d, t, want, label] of cases) {
    const got = run(d, t), ok = Math.abs(got - want) < 1e-9; if (!ok) fail++;
    console.log(`${ok ? "OK  " : "GAGAL"} ${file} | ${label}: ${got} (harus ${want})`);
  }
}
process.exit(fail ? 1 : 0);
