
import { Router } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { requireApproved } from '../middleware/requireApproved.js';
import { adminDb } from '../config/firebaseAdmin.js';
import { purchaseEpisode } from '../services/purchase.service.js';

const router = Router();

router.use(authenticate, requireApproved);

router.post('/episode', async (req, res, next) => {
  try {
    const { webtoonId, episodeId } = req.body || {};

    const result = await purchaseEpisode(
      req.user.uid,
      webtoonId,
      episodeId
    );

    res.json(result);
  } catch (error) {
    if (error.message === '코인이 부족하다.') {
      return res.status(402).json({ error: error.message });
    }
    if (error.message === '공개된 작품이 아니다.' ||
        error.message === '공개된 회차가 아니다.') {
      return res.status(404).json({ error: error.message });
    }
    next(error);
  }
});

router.get('/history', async (req, res, next) => {
  try {
    const snap = await adminDb.collection('purchases')
      .where('uid', '==', req.user.uid)
      .limit(100)
      .get();

    res.json({
      purchases: snap.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate().toISOString() ?? null
      }))
    });
  } catch (error) {
    next(error);
  }
});

export default router;
