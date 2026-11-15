import { Router } from 'express';
import { requireAdmin, requireUser } from '../middleware/auth.js';
import { adminDrawSummary, adminPickWinners, enterDraw, getDraw, getMyEntry } from '../controllers/draw.js';

const router = Router();

router.get('/', getDraw);
router.get('/me', requireUser, getMyEntry);
router.post('/entries', requireUser, enterDraw);
router.get('/summary', requireAdmin, adminDrawSummary);
router.post('/pick', requireAdmin, adminPickWinners);

export default router;
