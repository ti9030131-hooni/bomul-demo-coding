import mongoose from 'mongoose';

// 완주 보상 추첨 응모 — 시즌마다 한 사람당 1건 (season + user 고유)
const drawEntrySchema = new mongoose.Schema(
  {
    season: { type: String, required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    courseId: { type: String, required: true },                 // 처음 응모한(완주한) 코스
    courseTitle: { type: String, default: '' },
    source: { type: String, enum: ['completion', 'free'], default: 'completion' },   // 완주 응모 | 무료 응모(구매 없이)
    prizeRank: { type: Number, default: null },                 // 추첨 뒤 당첨 등수
    drawnAt: { type: Date, default: null },
  },
  { timestamps: true },
);
drawEntrySchema.index({ season: 1, user: 1 }, { unique: true });

export default mongoose.model('DrawEntry', drawEntrySchema);
