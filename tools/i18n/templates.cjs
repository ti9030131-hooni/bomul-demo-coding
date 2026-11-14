/*
 * AR 탁본 화면에 자동으로 만들어지는 문구의 언어별 틀입니다.
 *  - ko 틀은 tools/ar-courses/build.cjs(정적 파일)와 server/src/services/arCourse.js(서버)가 만드는 문구와 똑같아야 합니다.
 *    build.cjs 가 ko 틀로 다시 만들어 실제 결과와 맞는지 확인한 뒤에만 번역을 사전에 넣습니다.
 *  - 다른 언어 틀은 같은 자리에 들어갈 번역 문구를 만듭니다.
 */
const hasJong = (w) => { const c = String(w || "").trim().slice(-1).charCodeAt(0); return c >= 0xac00 && c <= 0xd7a3 ? (c - 0xac00) % 28 > 0 : false; };
const eul = (w) => (hasJong(w) ? "을" : "를");
const clip = (t, n) => (t.length > n ? `${t.slice(0, n - 1).trim()}…` : t);
const firstKo = (t) => { const m = String(t).match(/^(.+?[.!?。])(\s|$)/); return (m ? m[1] : String(t)).trim(); };
const firstEn = (t) => { const m = String(t).match(/^(.+?[.!?])(\s|$)/); return (m ? m[1] : String(t)).trim(); };
const firstCjk = (t) => { const m = String(t).match(/^(.+?[。！？!?])/); return (m ? m[1] : String(t)).trim(); };
const EN_NUM = ["", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];
const EN_ORD = ["1st", "2nd", "3rd", "4th", "5th", "6th", "7th", "8th", "9th", "10th"];
const KANJI = ["一", "二", "三", "四", "五", "六", "七", "八", "九", "十"];

const T = {
  ko: {
    stripWhere: /^보물\s*\d+\s*·\s*/,
    ORDW: ["첫째", "둘째", "셋째", "넷째", "다섯째", "여섯째", "일곱째", "여덟째", "아홉째", "열째"],
    NUMW: ["", "한", "두", "세", "네", "다섯", "여섯", "일곱", "여덟", "아홉", "열"],
    unit: "보물", sealShort: "보물",
    first: firstKo, qctxLen: 90, certLen: 64,
    mark(i, unit) { return `${this.ORDW[i] || `${i + 1}째`} ${unit || "보물"}`; },
    photoAlt: (title) => `${title} 참고 이미지`,
    look: "현장 안내판과 주변을 둘러보며 이야기의 흔적을 찾아보세요.",
    q: "탁본에 새겨진 이야기를 읽고, 이곳에 잠든 보물의 이름을 골라 보세요.",
    explain: (story) => `${story} 자세한 이야기는 보물 여행 코스 상세 페이지에서 더 볼 수 있어요.`,
    cert(story, piece) { return `${clip(this.first(story), this.certLen)} 「${piece}」${eul(piece)} 찾음.`; },
    side: (place) => `보물 여행 ${place} 편`,
    finalName: (place) => `${place} 보물 인장`,
    story2(n, finalName) { return `코스 곳곳의 비석에는 이야기를 품은 보물이 하나씩 잠들어 있습니다. ${this.NUMW[n] || n} 곳의 비석을 모두 탁본으로 떠서 「${finalName}」${eul(finalName)} 완성하세요.`; },
    deed: "이야기가 깃든 보물을 탁본으로 되찾아",
    allDone(n, unit) { return `${this.NUMW[n] || n} 곳의 ${unit}${eul(unit)} 모두 모았어요. 보물 상자가 나타났습니다.`; },
    nextSeason: "다른 지역 코스에서도 새로운 보물이 기다립니다. 보물 여행 전체 코스를 둘러보세요.",
  },
  en: {
    stripWhere: /^Treasure\s*\d+\s*·\s*/,
    unit: "Treasure", sealShort: "Seal",
    first: firstEn, qctxLen: 170, certLen: 130,
    mark: (i) => `${EN_ORD[i] || `${i + 1}th`} Treasure`,
    photoAlt: (title) => `${title} reference image`,
    look: "Look around the information boards and surroundings on site to find traces of the story.",
    q: "Read the story carved in the rubbing and choose the name of the treasure sleeping here.",
    explain: (story) => `${story} You can read more of the story on the Bomul Travel course page.`,
    cert(story, piece) { return `${clip(this.first(story), this.certLen)} Found “${piece}”.`; },
    side: (place) => `Bomul Travel · ${place}`,
    finalName: (place) => `${place} Treasure Seal`,
    story2: (n, finalName) => `A treasure full of stories sleeps in each stone tablet along the course. Take rubbings of all ${EN_NUM[n] || n} tablets to complete the “${finalName}”.`,
    deed: "recovered story-filled treasures through rubbings and",
    allDone: (n) => `You collected all ${EN_NUM[n] || n} treasures. A treasure chest has appeared!`,
    nextSeason: "New treasures await in the other regional courses too. Explore all the Bomul Travel courses.",
  },
  ja: {
    stripWhere: /^宝物\s*\d+\s*·\s*/,
    unit: "宝物", sealShort: "宝物",
    first: firstCjk, qctxLen: 60, certLen: 46,
    mark: (i) => `第${KANJI[i] || i + 1}の宝物`,
    photoAlt: (title) => `${title}の参考画像`,
    look: "現地の案内板や周りを見回して、物語の痕跡を探してみましょう。",
    q: "拓本に刻まれた物語を読んで、ここに眠る宝物の名前を選んでください。",
    explain: (story) => `${story} 詳しい物語は宝物旅行のコース詳細ページで読めます。`,
    cert(story, piece) { return `${clip(this.first(story), this.certLen)} 「${piece}」を発見。`; },
    side: (place) => `宝物旅行 ${place}編`,
    finalName: (place) => `${place} 宝物印章`,
    story2: (n, finalName) => `コースのあちこちの石碑には、物語を秘めた宝物が一つずつ眠っています。${n}か所の石碑をすべて拓本に取って「${finalName}」を完成させましょう。`,
    deed: "物語の宿る宝物を拓本で取り戻し",
    allDone: (n) => `${n}か所の宝物をすべて集めました。宝箱が現れました。`,
    nextSeason: "ほかの地域のコースでも新しい宝物が待っています。宝物旅行の全コースを見てみましょう。",
  },
  zh: {
    stripWhere: /^宝物\s*\d+\s*·\s*/,
    unit: "宝物", sealShort: "宝物",
    first: firstCjk, qctxLen: 60, certLen: 46,
    mark: (i) => `第${KANJI[i] || i + 1}件宝物`,
    photoAlt: (title) => `${title}参考图片`,
    look: "环顾现场的介绍牌和周围，寻找故事的痕迹吧。",
    q: "读一读拓本上刻着的故事，选出沉睡在这里的宝物名称。",
    explain: (story) => `${story} 更多故事可在宝物旅行路线详情页查看。`,
    cert(story, piece) { return `${clip(this.first(story), this.certLen)} 找到了「${piece}」。`; },
    side: (place) => `宝物旅行 ${place}篇`,
    finalName: (place) => `${place}宝物印章`,
    story2: (n, finalName) => `路线各处的石碑里各沉睡着一件蕴含故事的宝物。把${n}处石碑全部拓印下来，完成「${finalName}」吧。`,
    deed: "通过拓本寻回了蕴含故事的宝物，",
    allDone: (n) => `${n}处的宝物全部集齐了。宝箱出现了！`,
    nextSeason: "其他地区的路线中也有新的宝物在等待。去看看宝物旅行的全部路线吧。",
  },
};
module.exports = { T, clip, hasJong };
