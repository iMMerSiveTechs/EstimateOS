// ─── Service template storage (Firestore-backed) ──────────────────────────
// Custom intake fields + material defaults per service.
// users/{uid}/templates/{verticalId}_{serviceId}

import {
  doc, getDoc, getDocs, setDoc, collection,
  serverTimestamp, Timestamp,
} from 'firebase/firestore';
import { auth, db } from '../firebase/config';
import { ServiceTemplate } from '../models/types';

function uid(): string {
  const user = auth.currentUser;
  if (!user) throw new Error('templates: user is not signed in');
  return user.uid;
}

function col() { return collection(db, 'users', uid(), 'templates'); }
function ref(id: string) { return doc(db, 'users', uid(), 'templates', id); }

function templateId(verticalId: string, serviceId: string) {
  return `${verticalId}_${serviceId}`;
}

function deserialize(data: Record<string, any>): ServiceTemplate {
  const ts = (v: any) =>
    v instanceof Timestamp ? v.toDate().toISOString() : (v ?? new Date().toISOString());
  return { ...data, updatedAt: ts(data.updatedAt) } as ServiceTemplate;
}

export async function getTemplate(verticalId: string, serviceId: string): Promise<ServiceTemplate | null> {
  const snap = await getDoc(ref(templateId(verticalId, serviceId)));
  return snap.exists() ? deserialize(snap.data()) : null;
}

export async function saveTemplate(template: ServiceTemplate): Promise<void> {
  await setDoc(
    ref(template.id),
    { ...template, updatedAt: serverTimestamp() },
  );
}

export async function listTemplates(): Promise<ServiceTemplate[]> {
  const snap = await getDocs(col());
  return snap.docs.map(d => deserialize(d.data()));
}
