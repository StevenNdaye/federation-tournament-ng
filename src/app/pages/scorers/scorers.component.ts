import {Component} from '@angular/core';
import {AngularFirestore} from '@angular/fire/compat/firestore';
import {map} from 'rxjs/operators';
import {Match} from '../../models/match';

@Component({
  selector: 'app-scorers',
  templateUrl: './scorers.component.html',
  styleUrls: ['./scorers.component.css']
})
export class ScorersComponent {
  rows$ = this.afs.collection<Match>('matches', ref => ref.where('status', '==', 'completed'))
    .valueChanges().pipe(map(matches => {
      const tally = new Map<string, { team: string, goals: number }>();
      matches.forEach(m => m.goals?.forEach(g => {
        const cur = tally.get(g.playerId) || {team: g.teamId, goals: 0};
        cur.goals += 1;
        tally.set(g.playerId, cur);
      }));
      return Array.from(tally.entries()).map(([playerId, v]) => ({playerId, teamId: v.team, goals: v.goals}))
        .sort((a, b) => b.goals - a.goals).slice(0, 50);
    }));

  displayedColumns = ['player', 'team', 'goals'];

  constructor(private afs: AngularFirestore) {
  }
}
