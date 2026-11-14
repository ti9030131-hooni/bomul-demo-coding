import mongoose from 'mongoose';

// 경유지별 AR 설정. 비워 두면 서버가 이야기(desc)로 수수께끼·증명서 문구를 자동으로 만듭니다.
const stopArSchema = new mongoose.Schema(
  {
    key: { type: String, default: '', trim: true }, // 진행 기록용 고정 아이디(바꾸면 기존 탁본 기록과 연결이 끊김)
    label: { type: String, default: '', trim: true }, // 비석에 새길 장소 이름(비우면 where에서 자동)
    piece: { type: String, default: '', trim: true }, // 보물 이름(비우면 name)
    q: { type: String, default: '', trim: true }, // 수수께끼 질문
    qctx: { type: String, default: '', trim: true }, // 질문 위에 보여 줄 이야기 한 줄
    opts: { type: [String], default: [] }, // 보기(2~6개)
    a: { type: Number, default: null }, // 정답 보기 번호(0부터)
    explain: { type: String, default: '', trim: true },
    look: { type: String, default: '', trim: true }, // 현장 미션(비우면 desc의 [미션] 뒤 문장)
    cert: { type: String, default: '', trim: true }, // 증명서 한 줄
    photo: { type: String, default: '', trim: true }, // 참고 사진 주소
    restore: { type: String, default: '', trim: true }, // 카메라에 겹칠 옛 모습 그림
    restoreYear: { type: String, default: '', trim: true }, // 그림의 연도
    restoreCaption: { type: String, default: '', trim: true }, // 그림 한 줄 설명
    model: { type: String, default: '', trim: true }, // 3D 보물(GLB) 주소
  },
  { _id: false },
);

const stopSchema = new mongoose.Schema(
  {
    where: { type: String, default: '', trim: true },
    name: { type: String, default: '', trim: true },
    desc: { type: String, default: '', trim: true },
    addr: { type: String, default: '', trim: true },
    lat: { type: Number, default: null, min: -90, max: 90 },
    lng: { type: Number, default: null, min: -180, max: 180 },
    ar: { type: stopArSchema, default: () => ({}) },
  },
  { _id: false },
);

// 코스 단위 AR 설정
const courseArSchema = new mongoose.Schema(
  {
    enabled: { type: Boolean, default: true },
    place: { type: String, default: '', trim: true }, // 비석 머리·표지의 짧은 지역 이름
    unit: { type: String, default: '', trim: true }, // '보물' 또는 '부적' 등
    finalName: { type: String, default: '', trim: true }, // 완성 인장 이름
    sealShort: { type: String, default: '', trim: true }, // 인장 가운데 두 글자
    h1: { type: String, default: '', trim: true },
    story: { type: [String], default: [] },
    deed: { type: String, default: '', trim: true },
    allDone: { type: String, default: '', trim: true },
    duration: { type: String, default: '', trim: true },
    nextSeason: { type: String, default: '', trim: true },
    storageKey: { type: String, default: '', trim: true },
    onsiteRadius: { type: Number, default: null, min: 10, max: 5000 },
    insideRadius: { type: Number, default: null, min: 50, max: 500000 },
    finalModel: { type: String, default: '', trim: true },
  },
  { _id: false },
);

const legendCourseSchema = new mongoose.Schema(
  {
    slug: { type: String, required: true, unique: true, trim: true },
    region: { type: String, required: [true, '지역은 필수입니다.'], trim: true },
    theme: { type: String, required: [true, '테마는 필수입니다.'], trim: true },
    title: { type: String, required: [true, '코스 제목은 필수입니다.'], trim: true },
    summary: { type: String, required: [true, '코스 설명은 필수입니다.'], trim: true },
    thumb: { type: String, default: '' },
    hero: { type: String, default: '' },
    map: { type: String, default: '' },
    info: {
      거리: { type: String, default: '' },
      소요시간: { type: String, default: '' },
      난이도: { type: String, default: '' },
      집결지: { type: String, default: '' },
    },
    stops: { type: [stopSchema], default: [] },
    stories: { type: [String], default: [] },
    ar: { type: courseArSchema, default: () => ({}) },
    syncVersion: { type: Number, default: 0 },
    arSyncVersion: { type: Number, default: 0 }, // AR 필드 비파괴 이전 버전
  },
  { timestamps: true },
);

export default mongoose.model('LegendCourse', legendCourseSchema);
