
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '../config/firebaseAdmin.js';

export async function getWallet(uid) {
  const ref = adminDb.collection('wallets').doc(uid);
  const snap = await ref.get();

  if (!snap.exists) {
    return { balance: 0 };
  }

  return { balance: snap.data().balance };
}

// 신규 지갑은 최초 1회만 만든다.
// 기존 지갑이 있다면 잔액을 다시 지급하지 않는다.
export async function initializeWallet(uid, initialBalance = 1000) {
  const walletRef = adminDb.collection('wallets').doc(uid);
  const ledgerRef = walletRef.collection('ledger').doc('initial-grant');

  return adminDb.runTransaction(async tx => {
    const walletSnap = await tx.get(walletRef);

    if (walletSnap.exists) {
      return { balance: walletSnap.data().balance, created: false };
    }

    tx.create(walletRef, {
      balance: initialBalance,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    });

    tx.create(ledgerRef, {
      type: 'grant',
      amount: initialBalance,
      balanceAfter: initialBalance,
      referenceId: 'initial-grant',
      createdAt: FieldValue.serverTimestamp()
    });

    return { balance: initialBalance, created: true };
  });
}

export async function listLedger(uid) {
  const snap = await adminDb.collection('wallets')
    .doc(uid)
    .collection('ledger')
    .orderBy('createdAt', 'desc')
    .limit(100)
    .get();

  return snap.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
    createdAt: doc.data().createdAt?.toDate().toISOString() ?? null
  }));
}
