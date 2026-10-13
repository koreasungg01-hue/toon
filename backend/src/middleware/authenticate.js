
import { adminAuth } from '../config/firebaseAdmin.js';

export async function authenticate(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ')
      ? header.slice(7)
      : '';

    if (!token) {
      return res.status(401).json({
        error: '로그인이 필요하다.'
      });
    }

    req.user = await adminAuth.verifyIdToken(token);
    next();
  } catch {
    return res.status(401).json({
      error: '로그인 토큰이 유효하지 않다.'
    });
  }
}
