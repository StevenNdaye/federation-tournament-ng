import {Injectable} from '@angular/core';
import {AngularFirestore} from '@angular/fire/compat/firestore';
import {Team} from '../models/team';
import {map, Observable} from 'rxjs';

@Injectable({providedIn: 'root'})
export class TeamService {
  constructor(private afs: AngularFirestore) {
  }

  list(): Observable<Team[]> {
    return this.afs.collection<Team>('federations', ref => ref.orderBy('createdAt', 'asc'))
      .snapshotChanges()
      .pipe(map(s => s.map(x => ({id: x.payload.doc.id, ...(x.payload.doc.data() as Team)}))));
  }

  get(id: string) {
    return this.afs.doc<Team>(`federations/${id}`).valueChanges();
  }

  add(team: Team) {
    return this.afs.collection('federations').add({...team, createdAt: Date.now()});
  }

  update(id: string, patch: Partial<Team>) {
    return this.afs.doc(`federations/${id}`).update(patch);
  }

  delete(id: string) {
    return this.afs.doc(`federations/${id}`).delete();
  }
}
