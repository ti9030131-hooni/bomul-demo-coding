import mongoose from 'mongoose';

const historySchema = new mongoose.Schema(
  {
    type: { type: String, enum: ['earn', 'use'], required: true },
    courseId: { type: String, default: '', trim: true },
    itemId: { type: String, default: '', trim: true },
    name: { type: String, default: '', trim: true },
    points: { type: Number, required: true },
    code: { type: String, default: '', trim: true },
    at: { type: Date, default: Date.now },
  },
  { _id: false },
);

const completionSchema = new mongoose.Schema(
  {
    courseId: { type: String, required: true, trim: true },
    earned: { type: Number, default: 0, min: 0 },
    at: { type: Date, default: Date.now },
  },
  { _id: false },
);

const arWalletSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    points: { type: Number, default: 0, min: 0 },
    history: { type: [historySchema], default: [] },
    completions: { type: [completionSchema], default: [] },
  },
  { timestamps: true },
);

export default mongoose.model('ArWallet', arWalletSchema);
