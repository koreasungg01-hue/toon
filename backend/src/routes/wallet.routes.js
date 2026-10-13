

import { Router } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { requireApproved } from '../middleware/requireApproved.js';
import { getWallet, listLedger } from '../services/wallet.service.js';

const router = Router();

router.use(authenticate, requireApproved);

router.get('/', async (req, res, next) => {
  try {
    const wallet = await getWallet(req.user.uid);
    res.json(wallet);
  } catch (error) {
    next(error);
  }
});

router.get('/ledger', async (req, res, next) => {
  try {
    res.json({ transactions: await listLedger(req.user.uid) });
  } catch (error) {
    next(error);
  }
});

export default router;
