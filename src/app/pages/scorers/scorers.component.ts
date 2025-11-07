import {Component} from '@angular/core';
import {AngularFirestore} from '@angular/fire/compat/firestore';
import {combineLatest, map, Observable} from 'rxjs';
import {Match} from '../../models/match';
import {Team} from '../../models/team';
import {TeamService} from '../../services/team.service';

type Row = {
  playerId: string;
  playerName?: string;
  teamId: string;
  teamName: string;
  goals: number;
};

@Component({
  selector: 'app-scorers',
  templateUrl: './scorers.component.html',
  styleUrls: ['./scorers.component.css']
})
export class ScorersComponent {
  private matches$: Observable<Match[]> = this.afs
    .collection<Match>('matches', ref => ref.where('status', '==', 'completed'))
    .valueChanges({idField: 'id'});

  private teams$: Observable<Team[]> = this.teamSvc.list();

  rows$: Observable<Row[]> = combineLatest([this.matches$, this.teams$]).pipe(
    map(([matches, teams]) => {
      const teamNameById = new Map<string, string>(
        (teams || []).map(t => [t.id!, t.country || (t as any).manager || t.id!])
      );

      const playerNameByTeam = new Map<string, Map<string, string>>();
      for (const t of teams || []) {
        const inner = new Map<string, string>();
        (t.players || []).forEach((p: any) => {
          const pid = p.id ?? p.playerId ?? p.name; // be flexible about your Player shape
          if (pid) inner.set(String(pid), p.name || String(pid));
        });
        if (t.id) playerNameByTeam.set(t.id, inner);
      }

      const tally = new Map<string, { teamId: string; playerId: string; goals: number }>();
      for (const m of matches || []) {
        (m.goals || []).forEach(g => {
          const key = `${g.teamId}|${g.playerId}`;
          const cur = tally.get(key) || {teamId: g.teamId, playerId: g.playerId, goals: 0};
          cur.goals += 1;
          tally.set(key, cur);
        });
      }

      const rows: Row[] = Array.from(tally.values()).map(v => {
        const teamName = teamNameById.get(v.teamId) ?? v.teamId;
        const playerName = playerNameByTeam.get(v.teamId)?.get(v.playerId);
        return {
          playerId: v.playerId,
          playerName,
          teamId: v.teamId,
          teamName,
          goals: v.goals,
        };
      });

      return rows.sort((a, b) => b.goals - a.goals).slice(0, 50);
    })
  );

  displayedColumns = ['player', 'team', 'goals'];

  constructor(private afs: AngularFirestore, private teamSvc: TeamService) {
  }
}
