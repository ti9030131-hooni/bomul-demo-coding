import { Router } from 'express';
import { getPaymentStatus } from '../controllers/payments.js';

const router = Router();

router.get('/status', getPaymentStatus);

export default router;
