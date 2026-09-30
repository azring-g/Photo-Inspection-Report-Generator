import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  getDocs,
  getDocFromServer,
  query,
  orderBy,
  limit,
  deleteDoc,
  Timestamp
} from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';
import { BillboardSite } from '../types';

// Ensure single Firebase app instance
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Use the provisioned database ID from config or fallback
const databaseId =
  (firebaseConfig as { firestoreDatabaseId?: string }).firestoreDatabaseId ||
  'ai-studio-btoinspectionpho-19d92119-5854-4a1d-a51b-a9a5436b8f72';
export const db = getFirestore(app, databaseId);

// Verify Firestore connection on startup as required by Firestore integration guidelines
export async function testFirestoreConnection(): Promise<boolean> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('Firestore offline:', error.message);
    }
    return false;
  }
}

export interface SavedReportDoc {
  id: string;
  siteNo: string;
  filename: string;
  location: string;
  size: string;
  format: string;
  visual: string;
  photoCount: number;
  driveUrl?: string;
  engineerEmail?: string;
  engineerUid?: string;
  createdAt: string;
  photosSummary?: string[];
}

/**
 * Save inspection report persistently into Firestore
 */
export async function saveReportToFirestore(report: Omit<SavedReportDoc, 'id'> & { id?: string }): Promise<string> {
  const reportId = report.id || `rep-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
  const reportRef = doc(db, 'reports', reportId);

  await setDoc(reportRef, {
    ...report,
    id: reportId,
    updatedAt: new Date().toISOString()
  });

  return reportId;
}

/**
 * Load latest saved inspection reports from Firestore
 */
export async function loadReportsFromFirestore(max: number = 25): Promise<SavedReportDoc[]> {
  try {
    const q = query(collection(db, 'reports'), orderBy('createdAt', 'desc'), limit(max));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((docSnap) => docSnap.data() as SavedReportDoc);
  } catch (err) {
    console.warn('Could not query Firestore reports directly, falling back:', err);
    return [];
  }
}

/**
 * Delete a report from Firestore
 */
export async function deleteReportFromFirestore(reportId: string): Promise<void> {
  await deleteDoc(doc(db, 'reports', reportId));
}

/**
 * Save custom inventory site into Firestore
 */
export async function saveSiteToFirestore(site: BillboardSite): Promise<void> {
  const siteRef = doc(db, 'inventory', site.siteNo);
  await setDoc(siteRef, site);
}

/**
 * Load all custom inventory sites from Firestore
 */
export async function loadSitesFromFirestore(): Promise<Record<string, BillboardSite>> {
  try {
    const snapshot = await getDocs(collection(db, 'inventory'));
    const sitesMap: Record<string, BillboardSite> = {};
    snapshot.docs.forEach((docSnap) => {
      const data = docSnap.data() as BillboardSite;
      sitesMap[data.siteNo] = data;
    });
    return sitesMap;
  } catch (err) {
    console.warn('Could not load sites from Firestore:', err);
    return {};
  }
}
