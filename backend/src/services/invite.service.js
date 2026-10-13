
import { randomBytes, createHash } from 'node:crypto';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '../config/firebaseAdmin.js';

const invites = adminDb.collection('invites');

function hashCode(code) {
  return createHash('sha256')
    .update(code.trim().toUpperCase())
    .digest('hex');
}

export async function createInvite({ createdBy, maxUses = 1, expiresInDays = 7 }) {
  if (!Number.isInteger(maxUses) || maxUses < 1 || maxUses > 100) {
    throw new Error('초대 횟수는 1~100 사이여야 한다.');
  }

  if (!Number.isInteger(expiresInDays) ||
      expiresInDays < 1 || expiresInDays > 90) {
    throw new Error('유효 기간은 1~90일이어야 한다.');
  }

  const code = randomBytes(9).toString('base64url').toUpperCase();
  const id = hashCode(code);
  const expiresAt = new Date(Date.now() + expiresInDays * 86400000);

  await invites.doc(id).create({
    createdBy,
    maxUses,
    usedCount: 0,
    status: 'active',
    expiresAt,
    createdAt: FieldValue.serverTimestamp()
  });

  return { code, maxUses, expiresAt: expiresAt.toISOString() };
}

export async function validateInvite(code) {
  if (typeof code !== 'string' || code.length < 8 || code.length > 40) {
    return false;
  }

  const ref = invites.doc(hashCode(code));
  const snap = await ref.get();

  if (!snap.exists) return false;

  const data = snap.data();

  return data.status === 'active' &&
    data.usedCount < data.maxUses &&
    data.expiresAt.toDate() > new Date();
}

export async function consumeInvite(code, uid) {
  if (typeof code !== 'string' || code.length < 8 || code.length > 40) {
    throw new Error('유효하지 않은 초대 코드다.');
  }

  const ref = invites.doc(hashCode(code));
  const userRef = adminDb.collection('users').doc(uid);

  await adminDb.runTransaction(async tx => {
    const inviteSnap = await tx.get(ref);
    const userSnap = await tx.get(userRef);

    if (!inviteSnap.exists) throw new Error('초대 코드를 찾을 수 없다.');
    if (!userSnap.exists) throw new Error('회원 프로필이 없다.');

    const invite = inviteSnap.data();
    const user = userSnap.data();

    if (user.inviteConsumed === true) {
      throw new Error('이미 초대 코드를 사용한 계정이다.');
    }

    if (
      invite.status !== 'active' ||
      invite.usedCount >= invite.maxUses ||
      !invite.expiresAt ||
      invite.expiresAt.toDate() <= new Date()
    ) {
      throw new Error('초대 코드가 만료됐거나 사용 한도를 초과했다.');
    }

    tx.update(ref, {
      usedCount: invite.usedCount + 1
    });

    tx.update(userRef, {
      inviteConsumed: true,
      inviteConsumedAt: FieldValue.serverTimestamp()
    });
  });
}
