import express, { Router } from 'express';
import { requireAdmin, requireUser } from '../middleware/auth.js';
import {
  adminCancelPayOrder, adminListPayOrders, createPayOrder, getAccess, getMyOrder, getPayConfig,
  inicisMobileReturn, inicisPcClose, inicisPcReturn, listMyTickets, mockConfirmPayOrder,
} from '../controllers/pay.js';

const router = Router();
// 이니시스 결제창은 결과를 form(urlencoded)으로 보냅니다
const form = express.urlencoded({ extended: false, limit: '64kb' });

router.get('/config', getPayConfig);
router.get('/access/:courseId', requireUser, getAccess);
router.get('/tickets', requireUser, listMyTickets);
router.post('/orders', requireUser, createPayOrder);
router.get('/my-orders/:orderId', requireUser, getMyOrder);
router.post('/mock-confirm', requireUser, mockConfirmPayOrder);
router.post('/inicis/return', form, inicisPcReturn);
router.get('/inicis/close', inicisPcClose);
router.post('/inicis/mobile-return', form, inicisMobileReturn);
router.get('/orders', requireAdmin, adminListPayOrders);
router.post('/orders/:orderId/cancel', requireAdmin, adminCancelPayOrder);

export default router;
