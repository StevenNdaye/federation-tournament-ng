import {Injectable} from '@angular/core';
import {AngularFirestore} from '@angular/fire/compat/firestore';
import {Team} from '../models/team';
import {Match} from '../models/match';
import {MatchService} from './match.service';

@Injectable({providedIn: 'root'})
export class BracketService {
  constructor(
    private matches: MatchService,
    private afs: AngularFirestore
  ) {
  }

  private async ensureActiveTournament(): Promise<string> {
    const ref = this.afs.doc<{ activeTournamentId?: string }>('meta/state').ref;
    const snap = await ref.get();
    const current = snap.data()?.activeTournamentId;
    if (current) return current;

    const tid = this.afs.createId();
    await ref.set({activeTournamentId: tid}, {merge: true});
    await this.afs.doc(`tournaments/${tid}`).set({createdAt: Date.now(), status: 'active'});
    return tid;
  }

  async startNewTournament(): Promise<string> {
    const tid = this.afs.createId();
    await this.afs.doc('meta/state').set({activeTournamentId: tid}, {merge: true});
    await this.afs.doc(`tournaments/${tid}`).set({createdAt: Date.now(), status: 'active'});
    return tid;
  }

  async seedQuarterFinals(teams: Team[], options?: { force?: boolean }) {
    if (teams.length < 8) throw new Error('Need at least 8 teams to start QF');

    const tid = await this.ensureActiveTournament();

    const existingQFs = await this.afs.collection('matches', ref =>
      ref.where('tournamentId', '==', tid).where('stage', '==', 'QF')
    ).ref.get();

    if (!existingQFs.empty && !options?.force) {
      throw new Error('Quarter-Finals already exist for the current tournament.');
    }

    const selected = teams.slice(0, 8);

    const pairs: [Team, Team, number][] = [
      [selected[0], selected[7], 1],
      [selected[3], selected[4], 2],
      [selected[1], selected[6], 3],
      [selected[2], selected[5], 4],
    ];

    const now = Date.now();

    for (const [home, away, pair] of pairs) {
      const m: Match = {
        tournamentId: tid,
        homeTeamId: home.id!, awayTeamId: away.id!,
        homeScore: 0, awayScore: 0,
        goals: [],
        status: 'scheduled',
        stage: 'QF',
        pair,
        mode: 'simulate',
        createdAt: now,
        updatedAt: now,
      } as Match;

      await this.matches.create(m);
    }
  }
}
