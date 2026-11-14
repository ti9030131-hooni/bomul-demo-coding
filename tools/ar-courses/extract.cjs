// bomul.html 안의 코스 데이터(COURSES, MAPGEO 등)를 꺼내 JSON으로 돌려줍니다.
const fs = require("fs"), path = require("path"), vm = require("vm");
module.exports = function extract(htmlPath) {
  const html = fs.readFileSync(htmlPath, "utf8");
  const a = html.indexOf("const COURSES=");
  const b = html.indexOf("function gmapEmbed");
  if (a < 0 || b < 0) throw new Error("bomul.html에서 코스 데이터를 찾지 못했습니다");
  const code = html.slice(a, b) + "\n;({COURSES, MAPGEO, STORIES, DETAILS, PHOTOS, IMAGES, INFOX, TIMELINES})";
  return vm.runInNewContext(code, {});
};
if (require.main === module) {
  const d = module.exports(path.join(__dirname, "../../client/public/bomul.html"));
  for (const c of d.COURSES) {
    const g = d.MAPGEO[c.id];
    console.log(c.id.padEnd(22), String(c.stops.length).padEnd(3), g ? g.length : "-", "|", c.title, "|", c.region, "|", c.stops.map(s => s.where).join(" / ").slice(0, 120));
  }
}
