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

arProgressSchema.index({ user: 1, courseId: 1 }, { unique: true });

export default mongoose.model('ArProgress', arProgressSchema);
