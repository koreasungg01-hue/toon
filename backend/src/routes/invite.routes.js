
import { Router } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { requireApproved } from '../middleware/requireApproved.js';
import { requireAdmin } from '../middleware/requireAdmin.js';
import {
  createInvite,
  validateInvite,
  consumeInvite
} from '../services/invite.service.js';

const router = Router();

router.post('/validate', async (req, res) => {
  const valid = await validateInvite(req.body?.code || '');
  res.json({ valid });
});

router.post('/consume', authenticate, async (req, res, next) => {
  try {
    await consumeInvite(req.body?.code || '', req.user.uid);
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

router.post('/create',
  authenticate,
  requireApproved,
  requireAdmin,
  async (req, res, next) => {
    try {
      const invite = await createInvite({
        createdBy: req.user.uid,
        maxUses: Number(req.body?.maxUses ?? 1),
        expiresInDays: Number(req.body?.expiresInDays ?? 7)
      });

      res.status(201).json(invite);
    } catch (error) {
      next(error);
    }
  }
);

export default router;
