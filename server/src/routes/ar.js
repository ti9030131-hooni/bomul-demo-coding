import { Router } from 'express';
import { requireAdmin, requireUser } from '../middleware/auth.js';
import { getArCourse, getArSettings, listArCourses, updateArSettings } from '../controllers/ar.js';
import { getLeaderboard, getWallet, postCheckin, postComplete, postRedeem } from '../controllers/arReward.js';

const router = Router();

router.get('/leaderboard/:courseId', getLeaderboard);
router.get('/courses', listArCourses);
router.get('/courses/:slug', getArCourse);
router.get('/settings', getArSettings);
router.patch('/settings', requireAdmin, updateArSettings);
router.post('/checkin', requireUser, postCheckin);
router.post('/complete', requireUser, postComplete);
router.get('/wallet', requireUser, getWallet);
router.post('/redeem', requireUser, postRedeem);

export default router;
