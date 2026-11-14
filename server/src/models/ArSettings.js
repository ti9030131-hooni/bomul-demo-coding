import mongoose from 'mongoose';

// AR 탁본 공통 설정(완주 상품, 1~5등 포인트 상품). 문서는 key: 'default' 하나만 씁니다.
const prizeSchema = new mongoose.Schema(
  {
    icon: { type: String, enum: ['cert', 'point', 'draw'], default: 'draw' },
    title: { type: String, required: true, trim: true },
    desc: { type: String, default: '', trim: true },
    points: { type: Number, default: 0, min: 0 },
    action: { type: String, default: '', trim: true },
    go: { type: String, enum: ['', 'cert', 'shop'], default: '' },
  },
  { _id: false },
);

const shopItemSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, trim: true },
    rank: { type: Number, min: 1, max: 99 },
    icon: { type: String, enum: ['crown', 'gift', 'voucher', 'coffee', 'ticket'], default: 'gift' },
    name: { type: String, required: true, trim: true },
    points: { type: Number, required: true, min: 1 },
    desc: { type: String, default: '', trim: true },
  },
  { _id: false },
);

const arSettingsSchema = new mongoose.Schema(
  {
    key: { type: String, default: 'default', unique: true },
    prizes: { type: [prizeSchema], default: [] },
    pointShop: { type: [shopItemSchema], default: [] },
  },
  { timestamps: true },
);

export default mongoose.model('ArSettings', arSettingsSchema);
