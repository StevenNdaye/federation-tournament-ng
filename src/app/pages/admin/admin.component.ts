import {Component, OnDestroy, OnInit} from '@angular/core';
import {AdminService, UserProfile} from '../../services/admin.service';
import {map, Subscription} from 'rxjs';
import {MatSnackBar} from '@angular/material/snack-bar';

type Role = 'admin' | 'representative';

@Component({
  selector: 'app-admin',
  templateUrl: './admin.component.html',
  styleUrls: ['./admin.component.css']
})
export class AdminComponent implements OnInit, OnDestroy {
  rows: Array<UserProfile & { id: string, role?: Role, isAdmin?: boolean }> = [];
  sub?: Subscription;
  saving: Record<string, boolean> = {};

  constructor(private admin: AdminService, private snack: MatSnackBar) {
  }

  ngOnInit(): void {
    this.sub = this.admin.listProfiles().subscribe(async profiles => {
      const enriched = await Promise.all(profiles.map(async p => {
        const [roleSnap, adminSnap] = await Promise.all([
          this.admin.getRole(p.id).pipe(map(r => r?.role as Role | undefined)).toPromise(),
          this.admin.isAdmin(p.id).pipe(map(a => !!a)).toPromise()
        ]);
        return {...p, role: roleSnap || 'representative', isAdmin: adminSnap};
      }));
      this.rows = enriched.sort((a, b) => (a.email || '').localeCompare(b.email || ''));
    });
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  async applyRole(uid: string, role: Role) {
    this.saving[uid] = true;
    try {
      await this.admin.setRole(uid, role);
      this.snack.open('Role updated', 'OK', {duration: 1500});
    } catch (e: any) {
      this.snack.open(e?.message || 'Failed to update role', 'Close', {duration: 2500});
    } finally {
      this.saving[uid] = false;
    }
  }

  async toggleAdmin(uid: string, makeAdmin: boolean) {
    this.saving[uid] = true;
    try {
      await this.admin.setAdmin(uid, makeAdmin);
      this.snack.open(makeAdmin ? 'Admin granted' : 'Admin revoked', 'OK', {duration: 1500});
      const row = this.rows.find(r => r.id === uid);
      if (row) row.isAdmin = makeAdmin;
    } catch (e: any) {
      this.snack.open(e?.message || 'Failed to change admin state', 'Close', {duration: 2500});
    } finally {
      this.saving[uid] = false;
    }
  }
}
