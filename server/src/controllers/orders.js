import mongoose from 'mongoose';
import Course from '../models/Course.js';
import Order, { ORDER_PAYMENTS, ORDER_STATUS } from '../models/Order.js';
import {
  confirmedOrderFields,
  duplicatePaymentResult,
  paymentIdsOf,
  reviewOrderFields,
} from '../services/orderPayment.js';
import { verifyPortOnePayment } from '../services/portone.js';

function httpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function isAdmin(user) {
  return user.user_type === 'admin';
}

function courseIdOf(value) {
  if (!mongoose.isValidObjectId(value)) throw httpError(400, '코스를 선택해 주세요.');
  return value;
}

function quantityOf(value) {
  const quantity = Number(value);
  if (!Number.isInteger(quantity) || quantity < 1) throw httpError(400, '수량은 1 이상이어야 합니다.');
  return quantity;
}

function peopleOf(value) {
  const people = Number(value);
  if (!Number.isInteger(people) || people < 1) throw httpError(400, '인원은 1명 이상이어야 합니다.');
  return people;
}

function dateOf(value) {
  const date = new Date(value);
  if (!value || Number.isNaN(date.getTime())) throw httpError(400, '여행 출발일을 입력해 주세요.');
  return date;
}

function timeOf(value) {
  const time = text(value);
  if (!/^\d{2}:\d{2}$/.test(time)) throw httpError(400, '출발시간을 입력해 주세요.');
  return time;
}

function placeOf(value) {
  const place = text(value);
  if (!place) throw httpError(400, '출발장소를 입력해 주세요.');
  return place;
}

function statusOf(value) {
  if (!ORDER_STATUS.includes(value)) {
    throw httpError(400, '주문 상태는 결제완료, 취소 또는 결제확인필요여야 합니다.');
  }
  return value;
}

function paymentOf(value) {
  if (!ORDER_PAYMENTS.includes(value)) throw httpError(400, '결제수단을 선택해 주세요.');
  return value;
}

function buyerOf(body, user) {
  const source = body?.buyer && typeof body.buyer === 'object' ? body.buyer : {};
  const name = text(source.name) || text(user.name);
  const phone = text(source.phone) || text(user.phone);
  const email = text(source.email) || text(user.email);
  if (!name || !phone || !email) throw httpError(400, '이름, 연락처, 이메일을 입력해 주세요.');
  return { name, phone, email };
}

function requestedItems(value) {
  if (!Array.isArray(value) || value.length === 0) throw httpError(400, '주문 코스를 1개 이상 담아 주세요.');
  const merged = new Map();
  for (const entry of value) {
    const courseId = String(courseIdOf(entry?.course));
    merged.set(courseId, (merged.get(courseId) ?? 0) + quantityOf(entry?.quantity));
  }
  return [...merged.entries()].map(([course, quantity]) => ({ course, quantity }));
}

async function orderItems(value) {
  const requested = requestedItems(value);
  const courses = await Course.find({ _id: { $in: requested.map((item) => item.course) } });
  if (courses.length !== requested.length) throw httpError(404, '코스를 찾을 수 없습니다.');

  return requested.map(({ course, quantity }) => {
    const found = courses.find((item) => String(item._id) === course);
    return {
      course: found._id,
      name: found.name,
      price: found.price,
      image: found.image,
      category: found.category,
      quantity,
    };
  });
}

function totalOf(items) {
  return items.reduce((sum, item) => sum + item.price * item.quantity, 0);
}

function logPaymentEvent(level, event, detail) {
  const line = JSON.stringify({
    at: new Date().toISOString(),
    event,
    ...detail,
  });
  if (level === 'error') console.error(`[payment] ${line}`);
  else console.info(`[payment] ${line}`);
}

async function findOrder(req) {
  if (!mongoose.isValidObjectId(req.params.id)) throw httpError(404, '주문을 찾을 수 없습니다.');
  const order = await Order.findById(req.params.id);
  if (!order) throw httpError(404, '주문을 찾을 수 없습니다.');
  if (!isAdmin(req.user) && String(order.user) !== String(req.user._id)) {
    throw httpError(403, '본인 주문만 다룰 수 있습니다.');
  }
  return order;
}

async function findExistingPaymentOrder(impUid, merchantUid) {
  return Order.findOne({
    $or: [{ imp_uid: impUid }, { merchant_uid: merchantUid }],
  });
}

async function saveReviewOrder(fields, reason, cause) {
  logPaymentEvent('error', 'order_save_failed_needs_review', {
    imp_uid: fields.imp_uid,
    merchant_uid: fields.merchant_uid,
    user: String(fields.user),
    reason,
    cause: cause instanceof Error ? cause.message : String(cause),
  });

  try {
    const review = await Order.create(reviewOrderFields(fields, reason));
    logPaymentEvent('error', 'payment_review_order_created', {
      order_id: String(review._id),
      imp_uid: fields.imp_uid,
      merchant_uid: fields.merchant_uid,
    });
    return review;
  } catch (saveError) {
    if (saveError?.code === 11000) {
      const existing = await findExistingPaymentOrder(fields.imp_uid, fields.merchant_uid);
      if (existing) return existing;
    }
    logPaymentEvent('error', 'payment_review_order_failed', {
      imp_uid: fields.imp_uid,
      merchant_uid: fields.merchant_uid,
      cause: saveError instanceof Error ? saveError.message : String(saveError),
    });
    throw cause instanceof Error ? cause : httpError(500, '주문을 저장하지 못했습니다.');
  }
}

export async function listOrders(req, res) {
  const filter = isAdmin(req.user) ? {} : { user: req.user._id };
  const orders = await Order.find(filter).sort({ createdAt: -1 });
  res.json(orders);
}

export async function getOrder(req, res) {
  res.json(await findOrder(req));
}

export async function createOrder(req, res) {
  const { imp_uid: impUid, merchant_uid: merchantUid } = paymentIdsOf(req.body);

  const existing = await findExistingPaymentOrder(impUid, merchantUid);
  const dup = duplicatePaymentResult(existing, req.user, isAdmin(req.user));
  if (dup) {
    logPaymentEvent('info', dup.event, {
      order_id: String(dup.order._id),
      imp_uid: impUid,
      merchant_uid: merchantUid,
      user: String(req.user._id),
    });
    res.status(dup.status).json(dup.order);
    return;
  }

  const items = await orderItems(req.body.items);
  const totalPrice = totalOf(items);
  const buyer = buyerOf(req.body, req.user);
  const payment = await verifyPortOnePayment({
    imp_uid: impUid,
    merchant_uid: merchantUid,
    expectedAmount: totalPrice,
  });

  const fields = confirmedOrderFields({
    userId: req.user._id,
    buyer,
    items,
    travel: {
      departure_date: dateOf(req.body.departure_date),
      departure_time: timeOf(req.body.departure_time),
      departure_place: placeOf(req.body.departure_place),
      people: peopleOf(req.body.people),
    },
    paymentMethod: paymentOf(req.body.payment_method),
    totalPrice,
    payment,
  });

  try {
    const order = await Order.create(fields);
    logPaymentEvent('info', 'order_confirmed', {
      order_id: String(order._id),
      imp_uid: order.imp_uid,
      merchant_uid: order.merchant_uid,
      amount: order.total_price,
      user: String(req.user._id),
    });
    res.status(201).json(order);
  } catch (error) {
    if (error?.code === 11000) {
      const raced = await findExistingPaymentOrder(impUid, merchantUid);
      if (raced) {
        res.status(200).json(raced);
        return;
      }
    }
    const review = await saveReviewOrder(
      fields,
      '결제 확인 후 주문 저장에 실패했습니다. 관리자 확인이 필요합니다.',
      error,
    );
    res.status(201).json(review);
  }
}

export async function updateOrder(req, res) {
  const order = await findOrder(req);

  if (req.body.status !== undefined) {
    if (!isAdmin(req.user) && req.body.status === '결제확인필요') {
      throw httpError(403, '관리자만 결제확인필요 상태로 변경할 수 있습니다.');
    }
    order.status = statusOf(req.body.status);
  }
  if (req.body.departure_date !== undefined) order.departure_date = dateOf(req.body.departure_date);
  if (req.body.departure_time !== undefined) order.departure_time = timeOf(req.body.departure_time);
  if (req.body.departure_place !== undefined) order.departure_place = placeOf(req.body.departure_place);
  if (req.body.people !== undefined) order.people = peopleOf(req.body.people);
  if (req.body.payment_note !== undefined && isAdmin(req.user)) {
    order.payment_note = text(req.body.payment_note) || undefined;
  }
  if (req.body.buyer && typeof req.body.buyer === 'object') {
    const name = text(req.body.buyer.name);
    const phone = text(req.body.buyer.phone);
    const email = text(req.body.buyer.email);
    if (req.body.buyer.name !== undefined && !name) throw httpError(400, '이름은 필수입니다.');
    if (req.body.buyer.phone !== undefined && !phone) throw httpError(400, '연락처는 필수입니다.');
    if (req.body.buyer.email !== undefined && !email) throw httpError(400, '이메일은 필수입니다.');
    if (name) order.buyer.name = name;
    if (phone) order.buyer.phone = phone;
    if (email) order.buyer.email = email;
  }

  await order.save();
  res.json(order);
}

export async function deleteOrder(req, res) {
  const order = await findOrder(req);
  await order.deleteOne();
  res.json({ message: '주문을 삭제했습니다.' });
}
