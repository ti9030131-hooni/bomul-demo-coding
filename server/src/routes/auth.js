import { Router } from 'express';
import { findUserId, login, loginMethodNotAllowed, resetPassword } from '../controllers/auth.js';
import { googleCallback, googleStart } from '../controllers/google.js';
import { naverCallback, naverStart } from '../controllers/naver.js';

const router = Router();

router.post('/', login);
router.all('/', loginMethodNotAllowed);
router.post('/find-id', findUserId);
router.post('/reset-password', resetPassword);
router.get('/naver', naverStart);
router.get('/naver/callback', naverCallback);
router.get('/google', googleStart);
router.get('/google/callback', googleCallback);

export default router;
