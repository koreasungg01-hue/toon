
import { initializeApp, applicationDefault, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

const projectId = process.env.FIREBASE_PROJECT_ID;

const app = getApps()[0] || initializeApp({
  credential: applicationDefault(),
  ...(projectId ? { projectId } : {})
});

export const adminAuth = getAuth(app);
export const adminDb = getFirestore(app);
