import {Injectable} from '@angular/core';
import {AngularFirestore} from '@angular/fire/compat/firestore';
import {Match} from '../models/match';
import {map, Observable} from 'rxjs';

@Injectable({providedIn: 'root'})
export class MatchService {
  constructor(private afs: AngularFirestore) {
  }

  listByStage(stage: 'QF' | 'SF' | 'F'): Observable<Match[]> {
    return this.afs.collection<Match>('matches', ref => ref.where('stage', '==', stage).orderBy('createdAt', 'asc'))
      .snapshotChanges()
      .pipe(map(s => s.map(x => ({id: x.payload.doc.id, ...(x.payload.doc.data() as Match)}))));
  }

  listCompleted(): Observable<Match[]> {
    return this.afs.collection<Match>('matches', ref => ref.where('status', '==', 'completed'))
      .valueChanges({idField: 'id'});
  }

  get(id: string) {
    return this.afs.doc<Match>(`matches/${id}`).valueChanges({idField: 'id'});
  }

  create(m: Match) {
    return this.afs.collection('matches').add({...m, createdAt: Date.now(), updatedAt: Date.now()});
  }

  update(id: string, patch: Partial<Match>) {
    return this.afs.doc(`matches/${id}`).update({...patch, updatedAt: Date.now()});
  }

  delete(id: string) {
    return this.afs.doc(`matches/${id}`).delete();
  }
}
