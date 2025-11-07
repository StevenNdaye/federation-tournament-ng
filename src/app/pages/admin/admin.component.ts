import { Component, OnInit } from '@angular/core';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { AngularFireAuth } from '@angular/fire/compat/auth';
import { combineLatest, map, of, switchMap, Observable } from 'rxjs';

type RoleRow = { uid: string; role: string };
type AdminRow = { uid: string; isAdmin: boolean };

type UserRow = {
  uid: string;
  email: string | null;
  displayName: string | null;
  providers: string[];
  role?: string;
  isAdmin?: boolean;
};

@Component({
  selector: 'app-admin',
  templateUrl: './admin.component.html',
  styleUrls: ['./admin.component.css']
})
export class AdminComponent implements OnInit {
  displayedColumns = ['email', 'name', 'providers', 'role', 'admin', 'actions'];
  rows$: Observable<UserRow[]> = of([]);
  loading = true;

  constructor(
    private afs: AngularFirestore,
    private afAuth: AngularFireAuth
  ) {}

  async ngOnInit() {
    await this.ensureSelfMirrorDocs();

    const profiles$ = this.afs
      .collection('userProfiles')
      .valueChanges({ idField: 'uid' }) as Observable<any[]>;

    this.rows$ = profiles$.pipe(
      switchMap((profiles: any[]) => {
        if (!profiles?.length) return of([] as UserRow[]);

        const roleGets: Observable<RoleRow>[] = profiles.map(p =>
          this.afs
            .doc(`userRoles/${p.uid}`)
            .valueChanges()
            .pipe(map((r: any) => ({ uid: p.uid, role: r?.role ?? 'representative' })))
        );

        const adminGets: Observable<AdminRow>[] = profiles.map(p =>
          this.afs
            .doc(`admins/${p.uid}`)
            .get()
            .pipe(map(s => ({ uid: p.uid, isAdmin: s.exists })))
        );

        return combineLatest([
          combineLatest(roleGets),
          combineLatest(adminGets)
        ]).pipe(
          map(([roles, admins]: [RoleRow[], AdminRow[]]) => {
            const roleMap = new Map<string, string>(roles.map(r => [r.uid, r.role]));
            const adminMap = new Map<string, boolean>(admins.map(a => [a.uid, a.isAdmin]));

            const rows: UserRow[] = profiles.map(p => ({
              uid: p.uid,
              email: p.email ?? null,
              displayName: p.displayName ?? null,
              providers: p.providers ?? [],
              role: roleMap.get(p.uid) || 'representative',
              isAdmin: !!adminMap.get(p.uid)
            }));
            return rows;
          })
        );
      }),
      map((rows: UserRow[]) =>
        rows.sort((a, b) => (a.email || '').localeCompare(b.email || ''))
      )
    );

    this.loading = false;
  }

  // ✅ Ensures that your own profile & role docs exist (for users created before functions were deployed)
  private async ensureSelfMirrorDocs() {
    const u = await this.afAuth.currentUser;
    if (!u) return;

    const profileRef = this.afs.doc(`userProfiles/${u.uid}`).ref;
    const roleRef = this.afs.doc(`userRoles/${u.uid}`).ref;

    const [pSnap, rSnap] = await Promise.all([profileRef.get(), roleRef.get()]);
    const batch = this.afs.firestore.batch();

    if (!pSnap.exists) {
      batch.set(profileRef, {
        uid: u.uid,
        email: u.email ?? null,
        displayName: u.displayName ?? null,
        photoURL: u.photoURL ?? null,
        providers: (u.providerData || []).map(p => p?.providerId).filter(Boolean),
        createdAt: Date.now()
      } as any, { merge: true } as any);
    }

    if (!rSnap.exists) {
      batch.set(roleRef, { role: 'representative', createdAt: Date.now() } as any, { merge: true } as any);
    }

    if (!pSnap.exists || !rSnap.exists) await batch.commit();
  }

  async setRole(row: UserRow, role: 'representative' | 'admin' | 'viewer') {
    await this.afs.doc(`userRoles/${row.uid}`).set({ role, updatedAt: Date.now() }, { merge: true });
  }

  async toggleAdmin(row: UserRow) {
    const ref = this.afs.doc(`admins/${row.uid}`).ref;
    const snap = await ref.get();
    if (snap.exists) await ref.delete();
    else await ref.set({ createdAt: Date.now() });
  }
}
