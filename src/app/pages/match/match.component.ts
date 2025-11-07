import {Component, OnInit} from '@angular/core';
import {ActivatedRoute} from '@angular/router';
import {AngularFirestore} from '@angular/fire/compat/firestore';
import {map, switchMap} from 'rxjs/operators';
import {Observable, firstValueFrom} from 'rxjs';
import {MatSnackBar} from '@angular/material/snack-bar';
import {Team} from "../../models/team";
import {TeamService} from "../../services/team.service";

export interface Match {
  id?: string;
  tournamentId: string;
  stage: 'QF' | 'SF' | 'F';
  pair: number;
  status: 'scheduled' | 'inprogress' | 'completed';
  mode: 'simulate' | 'play';
  homeTeamId: string;
  awayTeamId: string;
  homeScore: number;
  awayScore: number;
  goals: Array<{ minute: number; teamId: string; playerId: string }>;
  decision?: 'home' | 'away' | 'homeET' | 'awayET' | 'homePens' | 'awayPens';
  createdAt?: number;
  updatedAt?: number;
}

@Component({
  selector: 'app-match',
  templateUrl: './match.component.html'
})
export class MatchComponent implements OnInit {
  match$!: Observable<Match | undefined>;
  teams: Team[] = [];

  constructor(
    private route: ActivatedRoute,
    private afs: AngularFirestore,
    private snack: MatSnackBar,
    private teamSvc: TeamService
  ) {
    this.teamSvc.list().subscribe(ts => this.teams = ts || []);
  }

  nameOf(id?: string) {
    return this.teams.find(t => t.id === id)?.country || id || '—';
  }

  ngOnInit(): void {
    this.match$ = this.route.paramMap.pipe(
      switchMap(p =>
        this.afs.doc<Match>(`matches/${p.get('id')}`).snapshotChanges()
      ),
      map(snap => {
        const data = snap.payload.data();
        if (!data) return undefined;
        return {id: snap.payload.id, ...(data as Match)};
      })
    );
  }

  private uniqueMinutes(total: number): number[] {
    const s = new Set<number>();
    while (s.size < total) s.add(1 + Math.floor(Math.random() * 90));
    return Array.from(s).sort((a, b) => a - b);
  }

  private pickScorers(team: Team | undefined, count: number): string[] {
    const players = team?.players || [];
    if (!players.length) return Array(count).fill('Unknown');
    const ordered = [
      ...players.filter((p: any) => p.naturalPosition === 'AT'),
      ...players.filter((p: any) => p.naturalPosition === 'MD'),
      ...players.filter((p: any) => p.naturalPosition === 'DF'),
      ...players.filter((p: any) => p.naturalPosition === 'GK'),
    ];
    const pool = ordered.length ? ordered : players;
    return Array.from({length: count}, () => pool[Math.floor(Math.random() * pool.length)].name);
  }

  async simulate(m: Match | undefined) {
    if (!m?.id) {
      console.warn('simulate: missing match id', m);
      this.snack.open('Match id missing – cannot simulate', 'Close', {duration: 3000});
      return;
    }

    try {
      const home = Math.floor(Math.random() * 5);
      const away = Math.floor(Math.random() * 5);
      let decision: Match['decision'];
      if (home !== away) decision = home > away ? 'home' : 'away';
      else decision = Math.random() < 0.5 ? 'homePens' : 'awayPens';

      const [homeTeam, awayTeam] = await Promise.all([
        firstValueFrom(this.teamSvc.get(m.homeTeamId)),
        firstValueFrom(this.teamSvc.get(m.awayTeamId)),
      ]);

      const mins = this.uniqueMinutes(home + away);
      const homeScorers = this.pickScorers(homeTeam, home);
      const awayScorers = this.pickScorers(awayTeam, away);

      const goals: Match['goals'] = [
        ...homeScorers.map((name, i) => ({minute: mins[i], teamId: m.homeTeamId, playerId: name})),
        ...awayScorers.map((name, j) => ({minute: mins[home + j], teamId: m.awayTeamId, playerId: name})),
      ].sort((a, b) => a.minute - b.minute);

      await this.afs.doc(`matches/${m.id}`).update({
        homeScore: home,
        awayScore: away,
        goals,
        decision,
        status: 'completed',
        updatedAt: Date.now()
      });

      this.snack.open('Match completed ✔', 'OK', {duration: 2000});
    } catch (e: any) {
      console.error('simulate failed', e);
      this.snack.open(e?.message ?? 'Simulate failed', 'Close', {duration: 4000});
    }
  }
}
