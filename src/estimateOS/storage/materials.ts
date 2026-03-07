// ─── Materials library storage (Firestore-backed) ─────────────────────────
// users/{uid}/materials/{materialId}

import {
  collection, doc, getDoc, getDocs, setDoc, deleteDoc,
  query, orderBy, serverTimestamp, Timestamp,
} from 'firebase/firestore';
import { auth, db } from '../firebase/config';
import { Material } from '../models/types';

function uid(): string {
  const user = auth.currentUser;
  if (!user) throw new Error('MaterialRepository: user is not signed in');
  return user.uid;
}

function col() { return collection(db, 'users', uid(), 'materials'); }
function ref(id: string) { return doc(db, 'users', uid(), 'materials', id); }

function deserialize(data: Record<string, any>): Material {
  const ts = (v: any) =>
    v instanceof Timestamp ? v.toDate().toISOString() : (v ?? new Date().toISOString());
  return { ...data, createdAt: ts(data.createdAt), updatedAt: ts(data.updatedAt) } as Material;
}

export const MaterialRepository = {
  async getMaterial(id: string): Promise<Material | null> {
    const snap = await getDoc(ref(id));
    return snap.exists() ? deserialize(snap.data()) : null;
  },

  async upsertMaterial(material: Material): Promise<void> {
    await setDoc(ref(material.id), { ...material, updatedAt: serverTimestamp() });
  },

  async listMaterials(): Promise<Material[]> {
    const q = query(col(), orderBy('name', 'asc'));
    const snap = await getDocs(q);
    return snap.docs.map(d => deserialize(d.data()));
  },

  async deleteMaterial(id: string): Promise<void> {
    await deleteDoc(ref(id));
  },
};
