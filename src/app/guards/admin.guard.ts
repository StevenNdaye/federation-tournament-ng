import {Injectable} from '@angular/core';
import {CanActivate, Router, UrlTree} from '@angular/router';
import {AngularFireAuth} from '@angular/fire/compat/auth';
import {AngularFirestore} from '@angular/fire/compat/firestore';
import {firstValueFrom, map} from 'rxjs';

@Injectable({providedIn: 'root'})
export class AdminGuard implements CanActivate {
  constructor(private afAuth: AngularFireAuth, private afs: AngularFirestore, private router: Router) {
  }

  async canActivate(): Promise<boolean | UrlTree> {
    const user = await firstValueFrom(this.afAuth.authState);
    if (!user) return this.router.parseUrl('/login');

    const isAdmin$ = this.afs.doc(`admins/${user.uid}`).valueChanges().pipe(
      map(doc => !!doc)
    );

    const ok = await firstValueFrom(isAdmin$);
    return ok ? true : this.router.parseUrl('/login');
  }
}
