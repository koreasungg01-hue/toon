
import { adminDb } from '../config/firebaseAdmin.js';

export async function requireApproved(req, res, next) {
  try {
    const snap = await adminDb
      .collection('users')
      .doc(req.user.uid)
      .get();

    if (!snap.exists) {
      return res.status(403).json({
        error: '회원 프로필이 없다.'
      });
    }

    const profile = snap.data();

    if (profile.status !== 'approved') {
      return res.status(403).json({
        error: profile.status === 'suspended'
          ? '이용이 정지된 계정이다.'
          : '관리자 승인을 기다리는 중이다.',
        code: profile.status === 'suspended'
          ? 'SUSPENDED'
          : 'PENDING_APPROVAL'
      });
    }

    req.profile = profile;
    next();
  } catch (error) {
    next(error);
  }
}
