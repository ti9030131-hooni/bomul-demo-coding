import mongoose from 'mongoose';

// 결제로 얻은 코스 도전 권한
const courseTicketSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    orderId: { type: String, required: true, unique: true },
    productId: { type: String, required: true },
    scope: { type: String, enum: ['course', 'all'], required: true },
    courseId: { type: String, default: '' },                          // scope=course 일 때만 의미
    startsAt: { type: Date, required: true },
    expiresAt: { type: Date, required: true },
    status: { type: String, enum: ['active', 'refunded'], default: 'active' },
  },
  { timestamps: true },
);

export default mongoose.model('CourseTicket', courseTicketSchema);
