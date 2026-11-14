import mongoose from 'mongoose';

const ORDER_STATUSES = ['결제완료', '취소', '결제확인필요'];
const PAYMENT_METHODS = ['신용카드', '계좌이체', '네이버페이'];

const orderItemSchema = new mongoose.Schema(
  {
    course: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Course',
      required: [true, '코스는 필수입니다.'],
    },
    name: {
      type: String,
      required: [true, '코스 이름은 필수입니다.'],
      trim: true,
    },
    price: {
      type: Number,
      required: [true, '코스 가격은 필수입니다.'],
      min: [0, '코스 가격은 0 이상이어야 합니다.'],
    },
    image: {
      type: String,
      required: [true, '이미지는 필수입니다.'],
      trim: true,
    },
    category: {
      type: String,
      required: [true, '카테고리는 필수입니다.'],
      trim: true,
    },
    quantity: {
      type: Number,
      required: [true, '수량은 필수입니다.'],
      min: [1, '수량은 1 이상이어야 합니다.'],
    },
  },
  { _id: false },
);

const orderSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, '회원은 필수입니다.'],
    },
    buyer: {
      name: {
        type: String,
        required: [true, '이름은 필수입니다.'],
        trim: true,
      },
      phone: {
        type: String,
        required: [true, '연락처는 필수입니다.'],
        trim: true,
      },
      email: {
        type: String,
        required: [true, '이메일은 필수입니다.'],
        trim: true,
        lowercase: true,
      },
    },
    items: {
      type: [orderItemSchema],
      required: [true, '주문 코스는 필수입니다.'],
      validate: {
        validator(items) {
          return Array.isArray(items) && items.length > 0;
        },
        message: '주문 코스를 1개 이상 담아 주세요.',
      },
    },
    departure_date: {
      type: Date,
      required: [true, '여행 출발일은 필수입니다.'],
    },
    departure_time: {
      type: String,
      required: [true, '출발시간은 필수입니다.'],
      trim: true,
    },
    departure_place: {
      type: String,
      required: [true, '출발장소는 필수입니다.'],
      trim: true,
    },
    people: {
      type: Number,
      required: [true, '인원은 필수입니다.'],
      min: [1, '인원은 1명 이상이어야 합니다.'],
    },
    payment_method: {
      type: String,
      required: [true, '결제수단은 필수입니다.'],
      enum: {
        values: PAYMENT_METHODS,
        message: '결제수단은 신용카드, 계좌이체, 네이버페이 중 하나여야 합니다.',
      },
    },
    total_price: {
      type: Number,
      required: [true, '합계 금액은 필수입니다.'],
      min: [0, '합계 금액은 0 이상이어야 합니다.'],
    },
    /** 포트원 결제 고유번호 */
    imp_uid: {
      type: String,
      trim: true,
      default: undefined,
    },
    /** 가맹점 주문번호 */
    merchant_uid: {
      type: String,
      trim: true,
      default: undefined,
    },
    /** 결제사에 기록된 승인 금액 */
    paid_amount: {
      type: Number,
      min: [0, '결제 금액은 0 이상이어야 합니다.'],
      default: undefined,
    },
    /** 포트원 결제 상태 (paid 등) */
    pg_status: {
      type: String,
      trim: true,
      default: undefined,
    },
    /** 관리자 확인용 메모 (결제확인필요 등) */
    payment_note: {
      type: String,
      trim: true,
      default: undefined,
    },
    status: {
      type: String,
      enum: {
        values: ORDER_STATUSES,
        message: '주문 상태는 결제완료, 취소 또는 결제확인필요여야 합니다.',
      },
      default: '결제완료',
      required: [true, '주문 상태는 필수입니다.'],
    },
  },
  { timestamps: true },
);

orderSchema.index(
  { imp_uid: 1 },
  { unique: true, partialFilterExpression: { imp_uid: { $type: 'string' } } },
);
orderSchema.index(
  { merchant_uid: 1 },
  { unique: true, partialFilterExpression: { merchant_uid: { $type: 'string' } } },
);

export const ORDER_STATUS = ORDER_STATUSES;
export const ORDER_PAYMENTS = PAYMENT_METHODS;
export default mongoose.model('Order', orderSchema);
