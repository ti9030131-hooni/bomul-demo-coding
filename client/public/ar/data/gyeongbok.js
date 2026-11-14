/*
 * 보물 여행 AR — 경복궁 특별 코스 데이터 (손으로 다듬은 문항·약도)
 *
 *  - photo : 현장 안내 사진. 지금은 /img 의 기존 사진을 임시로 쓰고 있습니다. (TODO: 현장 촬영본으로 교체)
 *  - model : 3D 보물(GLB). 임시 모델입니다. (TODO: 디자이너 모델로 교체)
 *  - cert  : 완주 증명서(A4)에 들어가는 장소별 탐험 내용 한 줄 요약.
 *  - lat/lng : 지도에서 잡은 근사 좌표입니다. (TODO: 현장 답사 후 보정)
 * 완주 상품·포인트 상품은 data/common.js 에서 모든 코스가 함께 씁니다.
 * 경로는 /ar/course.html 기준 상대 경로입니다.
 */
window.BOMUL_COURSES = window.BOMUL_COURSES || {};
window.BOMUL_DEFAULT_COURSE = "seoul-gyeongbok-ar";
window.BOMUL_COURSES["seoul-gyeongbok-ar"] = {
  id: "seoul-gyeongbok-ar",
  title: "경복궁, 불을 막는 다섯 부적",
  region: "서울",
  storageKey: "bomul-gbg-v1",
  center: { lat: 37.5796, lng: 126.9770 },
  insideRadius: 450,   // 이 거리(m) 안이면 "경복궁 안"으로 안내
  onsiteRadius: 70,    // 장소에서 이 거리(m) 안이면 "현장 탁본"으로 기록
  text: {
    place: "경복궁",
    side: "보물 여행 경복궁 편",
    h1: "경복궁, 불을 막는<br>다섯 부적",
    story: [
      "경복궁은 임진왜란 때 불에 타 270여 년 동안 빈터로 남았다가 1860년대에 다시 지어졌습니다. 다시는 불에 타지 않기를 바라는 마음은 궁궐 곳곳에 숨겨진 ‘불을 막는 장치’로 남았지요.",
      "전설에 따르면 이 장치들에는 불귀신 화마를 잠재우는 부적이 하나씩 깃들어 있다고 합니다. 다섯 부적을 모두 탁본으로 떠서 「진화부」를 완성하세요.",
    ],
    duration: "약 90분",
    unit: "부적",
    sealShort: "진화",
    deed: "불을 막는 부적을 탁본으로 되찾아",
    allDone: "다섯 부적을 모두 모았어요. 화마가 잠들었습니다.",
  },
  final: {
    name: "진화부",
    model: "models/jinhwabu.glb",
    nextSeason: "창덕궁 후원, 늙지 않는다는 불로문 너머에 잠긴 보물이 기다립니다.",
  },
  // 손으로 그린 경복궁 약도 (자동 약도 대신 사용)
  map: {
    proj: { lat0: 37.57596, lng0: 126.97689, x0: 180, y0: 512, kx: 88200, s: 0.55 },
    route: "M180 512 L180 368 C162 344 142 300 122 280 C140 258 166 240 180 226 L180 116",
    base: `<rect class="m-wall" x="24" y="20" width="312" height="498" rx="2"/>
      <rect class="m-bld" x="152" y="40" width="56" height="16"/><text class="m-label" x="216" y="52">건청궁</text>
      <ellipse class="m-water" cx="180" cy="104" rx="44" ry="30"/>
      <line class="m-thin" x1="180" y1="74" x2="180" y2="60"/>
      <ellipse class="m-thin" cx="180" cy="226" rx="24" ry="7"/>
      <rect class="m-bld" x="160" y="240" width="40" height="12"/><text class="m-label" x="206" y="250">교태전</text>
      <rect class="m-bld" x="156" y="264" width="48" height="12"/><text class="m-label" x="210" y="274">강녕전</text>
      <rect class="m-bld" x="164" y="288" width="32" height="12"/><text class="m-label" x="202" y="298">사정전</text>
      <rect class="m-water" x="70" y="246" width="76" height="66" rx="3"/>
      <rect class="m-bld" x="98" y="266" width="24" height="26"/>
      <rect class="m-thin" x="146" y="314" width="68" height="88"/>
      <rect class="m-bld" x="160" y="340" width="40" height="20"/>
      <line class="m-thin" x1="156" y1="346" x2="204" y2="346"/>
      <rect class="m-bld" x="168" y="396" width="24" height="9"/>
      <rect class="m-bld" x="162" y="444" width="36" height="10"/><text class="m-label" x="204" y="453">흥례문</text>
      <rect class="m-bld" x="150" y="510" width="60" height="16"/>`,
  },
  stops: [
    { id: "gwanghwa", name: "광화문", mark: "첫째 부적", lat: 37.57596, lng: 126.97689,
      photo: "../img/seoul-hanyang-hero.jpg", photoAlt: "궁궐 지붕과 남산이 보이는 한양 풍경 그림",
      restore: "restore/gwanghwa-before.jpg", restoreYear: "1592년 이전", restoreCaption: "임진왜란으로 타기 전의 광화문",
      model: "models/haechi-horn.glb", piece: "해치의 뿔",
      lx: -36, ly: 0, anchor: "end",
      cert: "경복궁의 정문(1395년 창건, 2010년 제자리 복원). 옳고 그름을 가리고 불기운을 누른다는 해치를 찾아 첫째 부적을 얻음.",
      story: "1395년 태조가 세운 경복궁의 정문입니다. 지금의 광화문은 2010년에 제자리를 찾아 다시 지은 모습이에요. 문 앞을 지키는 돌짐승에게 첫 번째 부적이 깃들어 있다고 합니다.",
      look: "광화문 앞 양쪽에 앉은 돌짐승을 찾아 얼굴과 머리 위의 뿔을 살펴보세요.",
      q: "옳고 그름을 가리고 불기운을 누른다고 전해지는, 광화문 앞의 상상의 동물은?",
      opts: ["기린", "해치", "현무", "봉황"], a: 1,
      explain: "해치(해태)는 시비와 선악을 가린다는 상상의 동물이에요. 광화문 앞 해치는 남쪽 관악산의 불기운을 누르기 위해 세웠다는 이야기가 함께 전해집니다." },

    { id: "geunjeong", name: "근정전", mark: "둘째 부적", lat: 37.57860, lng: 126.97700,
      photo: "../img/photo-seoul.jpg", photoAlt: "2층 지붕의 근정전과 월대",
      restore: "restore/geunjeong-before.jpg", restoreYear: "1592년 이전", restoreCaption: "불타기 전의 근정전",
      model: "models/deume-mirror.glb", piece: "드므의 물거울",
      lx: 20, ly: 4,
      cert: "즉위식과 조회가 열리던 경복궁의 중심 전각(국보). 화마를 놀라 달아나게 한 물그릇 드므를 찾아 둘째 부적을 얻음.",
      story: "왕의 즉위식과 큰 조회가 열리던 경복궁의 중심 건물로, 국보로 지정되어 있습니다. 넓은 마당에는 신하들이 벼슬 순서대로 서던 품계석이 줄지어 있어요.",
      look: "근정전을 받친 돌 기단(월대) 위에서 물을 담아 두던 넓적한 그릇을 찾아보세요.",
      q: "불귀신 화마가 물에 비친 제 얼굴에 놀라 달아나도록 근정전 월대에 놓아 둔 넓적한 그릇은?",
      opts: ["향로", "풍경", "드므", "가마솥"], a: 2,
      explain: "드므는 물을 채워 두는 넓적한 그릇이에요. 화마가 물에 비친 무서운 제 얼굴을 보고 놀라 달아난다는 이야기가 전해지고, 실제로 불이 나면 끄는 물로도 쓸 수 있었습니다." },

    { id: "gyeonghoe", name: "경회루", mark: "셋째 부적", lat: 37.57970, lng: 126.97570,
      photo: "../img/dawn-pavilion.jpg", photoAlt: "새벽 안개 낀 연못 위의 누각",
      restore: "restore/gyeonghoe-before.jpg", restoreYear: "1592년 이전", restoreCaption: "불타기 전의 경회루",
      model: "models/dragon-pearl.glb", piece: "청동 용의 여의주",
      lx: -58, ly: 0, anchor: "end",
      cert: "연못 위에서 잔치를 열던 누각(국보), 48개의 돌기둥. 1997년 연못에서 나온 청동 용 이야기로 셋째 부적을 얻음.",
      story: "나라에 경사가 있을 때 잔치를 열고 외국 사신을 맞던 누각으로, 국보입니다. 연못 위에 48개의 돌기둥이 누각을 떠받치고 있어요.",
      look: "바깥쪽 돌기둥은 네모, 안쪽은 둥근 기둥이에요. 하늘은 둥글고 땅은 네모나다는 옛 생각이 담겼다고 합니다.",
      q: "1997년 연못 바닥을 청소하다 옛 기록대로 발견된, 불을 막으려 넣었다는 청동 동물은?",
      opts: ["거북", "잉어", "용", "해치"], a: 2,
      explain: "1997년 경회루 연못을 준설하던 중 청동으로 만든 용이 발견되었어요. 물을 다스리는 용을 연못에 넣어 궁궐의 불을 막고자 했다는 옛 기록과 맞아떨어진 발견이었습니다." },

    { id: "amisan", name: "아미산", mark: "넷째 부적", lat: 37.58060, lng: 126.97705,
      photo: "../img/seoul-poster.jpg", photoAlt: "궁궐 앞마당에서 휴대폰을 보는 여행자",
      restore: "restore/amisan-before.jpg", restoreYear: "고종 중건", restoreCaption: "교태전 뒤 아미산의 화계와 굴뚝",
      model: "models/amisan-chimney.glb", piece: "굴뚝의 마지막 연기",
      lx: 30, ly: -2,
      cert: "교태전 뒤뜰 꽃동산과 육각형 굴뚝 4기(보물). 온돌 연기가 빠져나가던 굴뚝을 세어 넷째 부적을 얻음.",
      story: "왕비가 지내던 교태전 뒤에 꾸민 작은 꽃동산입니다. 경회루 연못을 팔 때 나온 흙으로 쌓았다고 전해져요.",
      look: "꽃동산 위에 선 붉은 벽돌 굴뚝을 찾아보세요. 굴뚝 벽면에 새겨진 길상 무늬도 함께 살펴보세요.",
      q: "아미산 꽃동산에 서 있는 육각형 굴뚝은 모두 몇 개일까요? 현장에서 세어 보세요.",
      opts: ["2개", "3개", "4개", "6개"], a: 2,
      explain: "아미산에는 육각형 굴뚝 4개가 서 있어요(보물). 교태전 온돌에서 나온 연기가 땅 밑 길을 지나 이 굴뚝으로 빠져나갔습니다." },

    { id: "hyangwon", name: "향원정", mark: "다섯째 부적", lat: 37.58260, lng: 126.97700,
      photo: "../img/action-poster.jpg", photoAlt: "안개 낀 연못 한가운데의 정자",
      restore: "restore/hyangwon-1887.jpg", restoreYear: "1887", restoreCaption: "건청궁에 켜진 첫 전등, 물불",
      model: "models/mulbul-ember.glb", piece: "물불의 불씨",
      lx: 52, ly: 4,
      cert: "연못 섬 위의 육각형 2층 정자. 1887년 건청궁에 처음 켜진 전등 ‘물불’ 이야기로 다섯째 부적을 얻음.",
      story: "고종 때 연못 한가운데 섬에 지은 육각형 2층 정자입니다. ‘향기가 멀리 퍼진다’는 뜻의 이름이에요. 연못 북쪽 건청궁에서는 1887년 우리나라에서 처음으로 전등이 켜졌습니다.",
      look: "정자로 건너가는 나무다리 ‘취향교’가 연못의 어느 쪽에 놓여 있는지 확인해 보세요.",
      q: "1887년 건청궁에 처음 켜진 전등은 연못 물로 발전기를 돌렸다고 전해져요. 사람들이 붙인 별명은?",
      opts: ["도깨비불", "반딧불", "물불", "등잔불"], a: 2,
      explain: "향원정 연못의 물을 끌어다 발전기를 돌렸다고 해서 ‘물불’이라 불렀다는 이야기가 전해집니다. 자주 꺼졌다 켜지기를 반복해 ‘건달불’이라는 별명도 있었어요." },
  ],
};
