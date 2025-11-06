import {Injectable} from '@angular/core';
import {AngularFireAuth} from '@angular/fire/compat/auth';
import firebase from 'firebase/compat/app';
import {AngularFirestore} from '@angular/fire/compat/firestore';
import {map, switchMap, of} from 'rxjs';

@Injectable({providedIn: 'root'})
export class AuthService {
  user$ = this.afAuth.authState;

  role$ = this.user$.pipe(
    switchMap(u => u ? this.afs.doc<{ role: string }>(`userRoles/${u.uid}`).valueChanges() : of(null)),
    map(doc => doc?.role ?? null)
  );

  constructor(private afAuth: AngularFireAuth, private afs: AngularFirestore) {
  }

  signInEmail(email: string, password: string) {
    return this.afAuth.signInWithEmailAndPassword(email, password);
  }

  registerEmail(email: string, password: string) {
    return this.afAuth.createUserWithEmailAndPassword(email, password);
  }

  google() {
    return this.afAuth.signInWithPopup(new firebase.auth.GoogleAuthProvider());
  }

  signOut() {
    return this.afAuth.signOut();
  }
}
