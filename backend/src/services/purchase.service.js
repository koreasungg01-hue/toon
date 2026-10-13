
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '../config/firebaseAdmin.js';

export async function purchaseEpisode(uid, webtoonId, episodeId) {
  if (!webtoonId || !episodeId) {
    throw new Error('작품 ID와 회차 ID가 필요하다.');
  }

  const db = adminDb;
  const walletRef = db.collection('wallets').doc(uid);
  const webtoonRef = db.collection('webtoons').doc(webtoonId);
  const episodeRef = webtoonRef.collection('episodes').doc(episodeId);

  // 구매 ID를 고정해 동일 회원의 중복 구매를 방지한다.
  const purchaseId = `${uid}_${webtoonId}_${episodeId}`;
  const purchaseRef = db.collection('purchases').doc(purchaseId);
  const ledgerRef = walletRef.collection('ledger').doc(`purchase-${webtoonId}-${episodeId}`);

  return db.runTransaction(async tx => {
    // 트랜잭션에서는 모든 읽기를 쓰기보다 먼저 실행한다.
    const [walletSnap, webtoonSnap, episodeSnap, purchaseSnap] =
      await Promise.all([
        tx.get(walletRef),
        tx.get(webtoonRef),
        tx.get(episodeRef),
        tx.get(purchaseRef)
      ]);

    if (!walletSnap.exists) throw new Error('지갑이 초기화되지 않았다.');
    if (!webtoonSnap.exists || webtoonSnap.data().status !== 'published') {
      throw new Error('공개된 작품이 아니다.');
    }

    if (!episodeSnap.exists || episodeSnap.data().published !== true) {
      throw new Error('공개된 회차가 아니다.');
    }

    if (purchaseSnap.exists) {
      return { alreadyPurchased: true };
    }

    const price = episodeSnap.data().price;

    if (!Number.isSafeInteger(price) || price < 0 || price > 100000) {
      throw new Error('회차 가격 설정이 올바르지 않다.');
    }

    const balance = walletSnap.data().balance;

    if (!Number.isSafeInteger(balance) || balance < price) {
      throw new Error('코인이 부족하다.');
    }

    const newBalance = balance - price;

    tx.update(walletRef, {
      balance: newBalance,
      updatedAt: FieldValue.serverTimestamp()
    });

    tx.create(purchaseRef, {
      uid,
      webtoonId,
      episodeId,
      price,
      createdAt: FieldValue.serverTimestamp()
    });

    tx.create(ledgerRef, {
      type: 'purchase',
      amount: -price,
      balanceAfter: newBalance,
      referenceId: purchaseId,
      createdAt: FieldValue.serverTimestamp()
    });

    return {
      alreadyPurchased: false,
      price,
      balance: newBalance
    };
  });
}
