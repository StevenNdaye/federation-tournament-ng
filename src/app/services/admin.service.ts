import {Injectable} from '@angular/core';
import {AngularFirestore} from '@angular/fire/compat/firestore';
import {map} from 'rxjs/operators';
import {Observable} from 'rxjs';

export interface UserProfile {
  uid: string;
  email?: string | null;
  displayName?: string | null;
  photoURL?: string | null;
  providers?: string[];
  createdAt?: number;
}

@Injectable({providedIn: 'root'})
export class AdminService {
  constructor(private afs: AngularFirestore) {
  }

  listProfiles(): Observable<(UserProfile & { id: string, role?: string, isAdmin?: boolean })[]> {
    return this.afs.collection<UserProfile>('userProfiles')
      .snapshotChanges()
      .pipe(map(snaps => snaps.map(s => ({id: s.payload.doc.id, ...(s.payload.doc.data() as UserProfile)}))));
  }

  getRole(uid: string) {
    return this.afs.doc<{ role: string }>(`userRoles/${uid}`).valueChanges();
  }

  setRole(uid: string, role: 'admin' | 'representative') {
    return this.afs.doc(`userRoles/${uid}`).set({role}, {merge: true});
  }

  setAdmin(uid: string, makeAdmin: boolean) {
    const ref = this.afs.doc(`admins/${uid}`);
    return makeAdmin ? ref.set({createdAt: Date.now()}) : ref.delete();
  }

  isAdmin(uid: string) {
    return this.afs.doc(`admins/${uid}`).valueChanges();
  }
}
