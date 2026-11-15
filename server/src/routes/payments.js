import { Router } from 'express';
import { getPaymentStatus, preparePayment } from '../controllers/payments.js';
import { requireUser } from '../middleware/auth.js';

const router = Router();

router.get('/status', getPaymentStatus);
router.post('/prepare', requireUser, preparePayment);

export default router;
