import mongoose from 'mongoose';

const checkinSchema = new mongoose.Schema(
  {
    stopId: { type: String, required: true, trim: true },
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },
    accuracy: { type: Number, required: true },
    at: { type: Date, required: true },
  },
  { _id: false },
);

const arProgressSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    courseId: { type: String, required: true, trim: true },
    checkins: { type: [checkinSchema], default: [] },
  },
  { timestamps: true },
);

// 문서 단위 유일: user+courseId. stopId 중복은 appendCheckinAtomic(findOneAndUpdate $ne)로 방지.
// (선택·승인 후) 별도 Checkin 컬렉션 unique(user, courseId, stopId) 로 DB 제약을 더할 수 있음. 운영 마이그레이션은 승인 전 금지.
arProgressSchema.index({ user: 1, courseId: 1 }, { unique: true });

export default mongoose.model('ArProgress', arProgressSchema);
