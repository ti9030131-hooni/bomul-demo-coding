import mongoose from 'mongoose';
import Cart from '../models/Cart.js';
import Course, { COURSE_CATEGORIES } from '../models/Course.js';
import LegendCourse from '../models/LegendCourse.js';

const LEGEND_CART_PRICE = 4000;
const DEFAULT_COURSE_IMAGE = '/img/app-course.jpg';

function httpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function quantityOf(value, fallback = 1) {
  const quantity = value === undefined ? fallback : Number(value);
  if (!Number.isInteger(quantity) || quantity < 1) {
    throw httpError(400, '수량은 1 이상이어야 합니다.');
  }
  return quantity;
}

function courseIdOf(value) {
  if (!mongoose.isValidObjectId(value)) throw httpError(400, '코스를 선택해 주세요.');
  return value;
}

function categoryOf(region) {
  const text = typeof region === 'string' ? region.trim() : '';
  if (COURSE_CATEGORIES.includes(text)) return text;
  if (text.includes('경주')) return '경주';
  if (text.includes('제주')) return '제주';
  if (text.includes('부여')) return '부여';
  if (text.includes('공주')) return '공주';
  if (text.includes('설악')) return '설악';
  if (text.includes('강원')) return '강원';
  if (text.includes('전라') || text.includes('호남')) return '전라';
  return '기타';
}

async function courseFromLegend(legendId) {
  const slug = typeof legendId === 'string' ? legendId.trim() : '';
  if (!slug) throw httpError(400, '코스를 선택해 주세요.');
  const legend = await LegendCourse.findOne({ slug }).lean();
  if (!legend) throw httpError(404, '코스를 찾을 수 없습니다.');

  const name = legend.title;
  const image = legend.thumb || legend.hero || DEFAULT_COURSE_IMAGE;
  const description = legend.summary || name;
  const category = categoryOf(legend.region);
  let course = await Course.findOne({ name });
  if (!course) {
    course = await Course.create({
      name,
      price: LEGEND_CART_PRICE,
      category,
      image,
      description,
    });
  }
  return course;
}

async function present(cart) {
  return cart.populate('items.course');
}

export async function getCart(req, res) {
  const cart = await Cart.findOne({ user: req.user._id }).populate('items.course');
  res.json(cart ?? { user: req.user._id, items: [] });
}

export async function addCartItem(req, res) {
  const quantity = quantityOf(req.body.quantity);
  let courseId = req.body.course;
  if (req.body.legend_id) {
    const course = await courseFromLegend(req.body.legend_id);
    courseId = course._id;
  } else {
    courseId = courseIdOf(courseId);
    const course = await Course.findById(courseId);
    if (!course) throw httpError(404, '코스를 찾을 수 없습니다.');
  }

  const cart = (await Cart.findOne({ user: req.user._id })) ?? new Cart({ user: req.user._id, items: [] });
  const item = cart.items.find((entry) => String(entry.course) === String(courseId));
  if (item) item.quantity += quantity;
  else cart.items.push({ course: courseId, quantity });
  await cart.save();
  res.status(201).json(await present(cart));
}

export async function updateCartItem(req, res) {
  const courseId = courseIdOf(req.params.courseId);
  const quantity = quantityOf(req.body.quantity, undefined);
  const cart = await Cart.findOne({ user: req.user._id });
  const item = cart?.items.find((entry) => String(entry.course) === String(courseId));
  if (!item) throw httpError(404, '장바구니에 없는 코스입니다.');

  item.quantity = quantity;
  await cart.save();
  res.json(await present(cart));
}

export async function removeCartItem(req, res) {
  const courseId = courseIdOf(req.params.courseId);
  const cart = await Cart.findOne({ user: req.user._id });
  if (!cart) throw httpError(404, '장바구니가 없습니다.');

  const before = cart.items.length;
  cart.items = cart.items.filter((entry) => String(entry.course) !== String(courseId));
  if (cart.items.length === before) throw httpError(404, '장바구니에 없는 코스입니다.');

  await cart.save();
  res.json(await present(cart));
}

export async function deleteCart(req, res) {
  await Cart.findOneAndDelete({ user: req.user._id });
  res.json({ message: '장바구니를 비웠습니다.' });
}
