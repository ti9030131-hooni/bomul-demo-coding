import mongoose from 'mongoose';

// 코스 도전권 결제 주문 (기존 Order(여행 주문)와 다른 컬렉션)
const payOrderSchema = new mongoose.Schema(
  {
    orderId: { type: String, required: true, unique: true },          // 이니시스 oid (40byte 이하, 영문·숫자·-_)
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    productId: { type: String, required: true },
    productName: { type: String, required: true },
    scope: { type: String, enum: ['course', 'all'], required: true },
    courseId: { type: String, default: '' },                          // 도전하려던 코스(전체 패스도 기록)
    courseTitle: { type: String, default: '' },
    amount: { type: Number, required: true, min: 1 },                 // 서버가 정한 금액
    days: { type: Number, required: true, min: 1 },
    methodId: { type: String, required: true },
    status: { type: String, enum: ['ready', 'paid', 'failed', 'canceled'], default: 'ready', index: true },
    mode: { type: String, enum: ['inicis', 'mock'], required: true },
    device: { type: String, enum: ['pc', 'mobile'], default: 'pc' },     // 이니시스 결제창 종류
    returnTo: { type: String, default: '' },                              // 결과를 보여 줄 화면 주소(허락한 사이트만)
    agreed: { type: [String], default: [] },
    termsVersion: { type: String, default: '' },
    paymentKey: { type: String, default: '' },                            // 이니시스 승인 TID
    method: { type: String, default: '' },                             // 이니시스가 알려준 실제 결제수단
    approvedAt: { type: Date, default: null },
    receiptUrl: { type: String, default: '' },
    failCode: { type: String, default: '' },
    failMessage: { type: String, default: '' },
    canceledAt: { type: Date, default: null },
    cancelReason: { type: String, default: '' },
  },
  { timestamps: true },
);

export default mongoose.model('PayOrder', payOrderSchema);
