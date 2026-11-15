import mongoose from 'mongoose';

// 완주 보상 추첨 응모
// - unique(season,user): 시즌마다 응모 슬롯 1개(free 또는 completion)
// - partial unique(user where source=free): 무료 응모는 회원 계정 통산 1회(시즌 무관)
const drawEntrySchema = new mongoose.Schema(
  {
    season: { type: String, required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    courseId: { type: String, required: true },                 // 처음 응모에 연결된 코스
    courseTitle: { type: String, default: '' },
    source: { type: String, enum: ['completion', 'free'], default: 'completion' },   // 완주 응모 | 무료 응모(로그인만)
    prizeRank: { type: Number, default: null },                 // 추첨 뒤 당첨 등수
    drawnAt: { type: Date, default: null },
  },
  { timestamps: true },
);
drawEntrySchema.index({ season: 1, user: 1 }, { unique: true });
drawEntrySchema.index(
  { user: 1 },
  {
    unique: true,
    partialFilterExpression: { source: 'free' },
    name: 'drawentry_user_free_once',
  },
);

export default mongoose.model('DrawEntry', drawEntrySchema);
