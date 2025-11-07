import {Injectable} from '@angular/core';
import {AngularFirestore} from '@angular/fire/compat/firestore';
import {Match} from '../models/match';
import {Observable} from 'rxjs';

@Injectable({providedIn: 'root'})
export class MatchService {
  constructor(private afs: AngularFirestore) {
  }

  listByStage(stage: 'QF' | 'SF' | 'F', tid: string) {
    return this.afs.collection<Match>('matches', ref =>
      ref.where('tournamentId', '==', tid).where('stage', '==', stage)
    ).valueChanges({idField: 'id'});
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
