import fs from "fs";
const s = fs.readFileSync("data/banpick.json", "utf8");
const d = JSON.parse(s);
const h = d.heroes["marco-polo"] || Object.values(d.heroes)[0];
console.log(Object.keys(h));
console.log(JSON.stringify({ name: h.name, wr: h.wr, pr: h.pr, win_rate: h.win_rate, pick_rate: h.pick_rate, ban_rate: h.ban_rate, clash: h.clash }, null, 2));
