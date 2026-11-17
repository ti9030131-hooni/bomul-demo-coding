import User from '../models/User.js';
import { paymentIdsOf } from '../services/orderPayment.js';
import { assertPaymentsEnabled, paymentsEnabled, PAYMENTS_DISABLED_MESSAGE } from '../services/payments.js';
import { verifyPortOnePayment } from '../services/portone.js';

const PAYMENTS = ['신용카드', '계좌이체', '네이버페이'];
const PLANS = {
  course: { id: 'course', title: '코스 1개 도전권', price: 3900, detail: '선택한 코스에 도전할 수 있습니다.' },
  all: { id: 'all', title: '전체 코스 도전권', price: 9900, detail: '모든 전설 코스에 도전할 수 있습니다.' },
  monthly: { id: 'monthly', title: '월구독권', price: 99000, detail: '한 달간 모든 전설 코스에 도전할 수 있습니다.' },
};

function httpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function membershipPayload(user) {
  const membership = user.membership ? (typeof user.membership.toObject === 'function' ? user.membership.toObject() : { ...user.membership }) : null;
  if (membership && (membership.plan === 'all' || membership.plan === 'monthly')) {
    membership.active = true;
  }
  return membership;
}

function hasFullAccess(user) {
  if (!user) return false;
  if (user.user_type === 'admin') return true;
  const pass = user.membership;
  if (!pass) return false;
  return Boolean(pass.active) || pass.plan === 'all' || pass.plan === 'monthly';
}

function writeMembership(user, data) {
  user.set('membership.active', data.active);
  user.set('membership.plan', data.plan);
  user.set('membership.courses', data.courses);
  user.set('membership.price', data.price);
  user.set('membership.purchased_at', data.purchased_at);
  user.set('membership.payment_method', data.payment_method);
  user.markModified('membership');
}

export function getMembership(req, res) {
  const enabled = paymentsEnabled();
  res.json({
    plans: Object.values(PLANS),
    payments: PAYMENTS,
    payments_enabled: enabled,
    message: enabled ? undefined : PAYMENTS_DISABLED_MESSAGE,
  });
}

export async function buyMembership(req, res) {
  assertPaymentsEnabled();
  const plan =
    req.body.plan === 'all' || req.body.plan === 'course' || req.body.plan === 'monthly' ? req.body.plan : '';
  if (!plan) throw httpError(400, '상품을 선택해 주세요.');
  if (req.body.agree !== true) throw httpError(400, '약관에 동의해 주세요.');
  const payment = typeof req.body.payment_method === 'string' ? req.body.payment_method.trim() : '';
  if (!PAYMENTS.includes(payment)) throw httpError(400, '결제수단을 선택해 주세요.');
  const courseId = typeof req.body.course_id === 'string' ? req.body.course_id.trim() : '';
  if (plan === 'course' && !courseId) throw httpError(400, '도전할 코스를 확인해 주세요.');

  const { imp_uid: impUid, merchant_uid: merchantUid } = paymentIdsOf(req.body);
  const expectedAmount = PLANS[plan].price;
  const verified = await verifyPortOnePayment({
    imp_uid: impUid,
    merchant_uid: merchantUid,
    expectedAmount,
  });

  const user = await User.findById(req.user.id);
  if (!user) throw httpError(401, '토큰이 올바르지 않습니다.');
  const owned = Array.isArray(user.membership?.courses) ? [...user.membership.courses] : [];
  if (hasFullAccess(user)) {
    res.json({ message: '이미 전체 코스를 이용할 수 있습니다.', price: 0, membership: membershipPayload(user) });
    return;
  }
  if (plan === 'course' && owned.includes(courseId)) {
    res.json({ message: '이미 이 코스를 구매했습니다.', price: PLANS.course.price, membership: membershipPayload(user) });
    return;
  }

  const fullAccess = plan === 'all' || plan === 'monthly';
  writeMembership(user, {
    active: fullAccess,
    plan,
    courses: fullAccess ? owned : owned.concat(courseId),
    price: verified.amount,
    purchased_at: new Date(),
    payment_method: payment,
  });
  await user.save();

  const fresh = await User.findById(user._id);
  res.json({
    message: '결제가 완료되었습니다.',
    price: verified.amount,
    membership: membershipPayload(fresh || user),
    imp_uid: verified.imp_uid,
    merchant_uid: verified.merchant_uid,
  });
}
