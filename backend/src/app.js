
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import inviteRoutes from './routes/invite.routes.js';
import { authenticate } from './middleware/authenticate.js';
import { requireApproved } from './middleware/requireApproved.js';
import { requireAdmin } from './middleware/requireAdmin.js';
import { adminDb } from './config/firebaseAdmin.js';

const app = express();

const allowedOrigins = (process.env.CLIENT_ORIGIN || 'http://localhost:5173')
  .split(',')
  .map(value => value.trim())
  .filter(Boolean);

app.use(helmet());
app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    callback(new Error('허용되지 않은 사이트에서 요청했다.'));
  }
}));
app.use(express.json({ limit: '1mb' }));

app.use('/api/invites', inviteRoutes);

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'bangkku-toongku-api' });
});

app.get('/api/me', authenticate, async (req, res, next) => {
  try {
    const snap = await adminDb.collection('users').doc(req.user.uid).get();

    if (!snap.exists) {
      return res.status(404).json({ error: '회원 프로필이 없다.' });
    }

    const profile = snap.data();

    res.json({
      uid: req.user.uid,
      email: req.user.email || null,
      displayName: profile.displayName || '',
      status: profile.status,
      role: profile.role || 'member'
    });
  } catch (error) {
    next(error);
  }
});

app.get(
  '/api/admin/pending-users',
  authenticate,
  requireApproved,
  requireAdmin,
  async (_req, res, next) => {
    try {
      const snap = await adminDb.collection('users')
        .where('status', '==', 'pending')
        .limit(100)
        .get();

      res.json({
        users: snap.docs.map(doc => ({
          uid: doc.id,
          ...doc.data()
        }))
      });
    } catch (error) {
      next(error);
    }
  }
);

app.post(
  '/api/admin/users/:uid/approve',
  authenticate,
  requireApproved,
  requireAdmin,
  async (req, res, next) => {
    try {
      await adminDb.collection('users').doc(req.params.uid).update({
        status: 'approved',
        approvedAt: new Date()
      });

      res.json({ ok: true });
    } catch (error) {
      next(error);
    }
  }
);

app.get('/api/admin/stats',
  authenticate,
  requireApproved,
  requireAdmin,
  async (_req, res, next) => {
    try {
      const [users, webtoons, purchases] = await Promise.all([
        adminDb.collection('users').count().get(),
        adminDb.collection('webtoons').count().get(),
        adminDb.collection('purchases').count().get()
      ]);

      res.json({
        members: users.data().count,
        webtoons: webtoons.data().count,
        purchases: purchases.data().count
      });
    } catch (error) {
      next(error);
    }
  }
);

app.use((req, res) => {
  res.status(404).json({ error: 'API 경로를 찾을 수 없다.' });
});

app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(500).json({ error: '서버 내부 오류가 발생했다.' });
});

export default app;
