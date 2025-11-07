import {Component, OnInit} from '@angular/core';
import {ActivatedRoute} from '@angular/router';
import {AngularFirestore} from '@angular/fire/compat/firestore';
import {map, switchMap, take} from 'rxjs/operators';
import {Observable, firstValueFrom} from 'rxjs';
import {MatSnackBar} from '@angular/material/snack-bar';
import {Team} from "../../models/team";
import {TeamService} from "../../services/team.service";

export interface GoalEvent {
  minute: number;
  teamId: string;
  playerId: string;
}

export type MatchStatus = 'scheduled' | 'in_progress' | 'completed';
export type Decision = 'home' | 'away' | 'homeET' | 'awayET' | 'homePens' | 'awayPens';
export type Side = 'home' | 'away';

export interface Match {
  id?: string;
  stage: 'QF' | 'SF' | 'F';
  pair: number;
  status: MatchStatus;
  mode: 'simulate' | 'play';
  homeTeamId: string;
  awayTeamId: string;
  homeScore: number;
  awayScore: number;
  goals: GoalEvent[];
  commentary?: string[];
  decision?: Decision;
  createdAt?: number;
  updatedAt?: number;
}

const BASE_SHOT_RATE = 0.03;         // per-team chance to create a shot each minute (was 0.004)
const ATK_BONUS = 0.00030;           // rating impact (was 0.00002)
const GOAL_PROB = 0.33;              // shot → goal (was 0.28)
const ET_RATE_MULTIPLIER = 0.60;     // extra time is tighter (was 0.75)

function pickWeightedSide(pHome: number, pAway: number): Side {
  const total = pHome + pAway;
  return (Math.random() < pHome / total) ? 'home' : 'away';
}

@Component({
  selector: 'app-match',
  templateUrl: './match.component.html'
})
export class MatchComponent implements OnInit {
  match$!: Observable<Match | undefined>;
  teams: Team[] = [];
  busy = false;
  liveComments: string[] = [];

  constructor(
    private route: ActivatedRoute,
    private afs: AngularFirestore,
    private snack: MatSnackBar,
    teamSvc: TeamService
  ) {
    teamSvc.list().subscribe(ts => this.teams = ts || []);
  }

  nameOf(id?: string) {
    return this.teams.find(t => t.id === id)?.country || id || '—';
  }

  playerName(playerId: string | undefined) {
    if (!playerId) return '';
    for (const t of this.teams) {
      const p = (t.players || []).find(pp => pp.id === playerId);
      if (p) return p.name;
    }
    return '';
  }

  ngOnInit(): void {
    this.match$ = this.route.paramMap.pipe(
      switchMap(p =>
        this.afs.doc<Match>(`matches/${p.get('id')}`).snapshotChanges()
      ),
      map(snap => {
        const data = snap.payload.data() as Match | undefined;
        if (!data) return undefined;
        return {id: snap.payload.id, ...data};
      })
    );
  }

  async simulate(m: Match | undefined) {
    if (!m?.id) {
      this.snack.open('Match id missing – cannot simulate', 'Close', {duration: 3000});
      return;
    }
    try {
      const home = Math.floor(Math.random() * 5);
      const away = Math.floor(Math.random() * 5);
      let decision: Decision;
      if (home !== away) {
        decision = home > away ? 'home' : 'away';
      } else {
        decision = Math.random() < 0.5 ? 'homePens' : 'awayPens';
      }

      await this.afs.doc(`matches/${m.id}`).update({
        homeScore: home,
        awayScore: away,
        goals: [],
        decision,
        status: 'completed',
        updatedAt: Date.now()
      });
      this.snack.open('Match completed ✔', 'OK', {duration: 2000});
    } catch (e: any) {
      this.snack.open(e?.message ?? 'Simulate failed', 'Close', {duration: 4000});
    }
  }

  async play(m: Match | undefined) {
    if (!m?.id) {
      this.snack.open('Match id missing – cannot play', 'Close', {duration: 3000});
      return;
    }
    this.busy = true;
    this.liveComments = [];
    try {
      const homeTeam = await this.getTeam(m.homeTeamId);
      const awayTeam = await this.getTeam(m.awayTeamId);
      if (!homeTeam || !awayTeam) throw new Error('Teams not found for this match');

      const homeAtk = Math.max(10, Math.min(100, Math.round(homeTeam.rating || 60)));
      const awayAtk = Math.max(10, Math.min(100, Math.round(awayTeam.rating || 60)));

      let home = 0, away = 0;
      const events: GoalEvent[] = [];
      const lines: string[] = [];
      const add = (min: number, text: string) => {
        const line = `${min}′ — ${text}`;
        lines.push(line);
        this.liveComments = [...lines];
      };

      add(1, `Kick-off! ${this.nameOf(m.homeTeamId)} vs ${this.nameOf(m.awayTeamId)}.`);

      // 90-minute loop
      for (let minute = 2; minute <= 90; minute++) {
        const pHome = BASE_SHOT_RATE + (homeAtk - 50) * ATK_BONUS;
        const pAway = BASE_SHOT_RATE + (awayAtk - 50) * ATK_BONUS;

        // Does a shot occur this minute?
        if (Math.random() < (pHome + pAway)) {
          const side: Side = pickWeightedSide(pHome, pAway);
          const isGoal = Math.random() < GOAL_PROB;
          if (isGoal) {
            const scorer = this.pickScorer(side === 'home' ? homeTeam : awayTeam);
            const teamId = side === 'home' ? m.homeTeamId : m.awayTeamId;
            const teamName = this.nameOf(teamId);
            add(minute, `GOAL! ${teamName} — ${scorer.name}`);
            if (side === 'home') home++; else away++;
            events.push({minute, teamId, playerId: scorer.id!});
          } else {
            add(minute, `${this.sideName(side, m)} chance goes begging.`);
          }
        } else if (minute % 15 === 0 && Math.random() < 0.6) {
          add(minute, this.genericBeat(minute, m));
        }
      }

      let decision: Decision | undefined;
      add(90, `Full-time: ${this.nameOf(m.homeTeamId)} ${home}–${away} ${this.nameOf(m.awayTeamId)}.`);

      if (home === away) {
        const etRes = this.playExtraTimeTuned(m, homeTeam, awayTeam, home, away, events, add);
        home = etRes.home;
        away = etRes.away;

        if (home === away) {
          const winner = this.playPenalties(m, add);
          decision = (winner === 'home') ? 'homePens' : 'awayPens';
          add(120, `Penalties decided it: ${this.nameOf(winner === 'home' ? m.homeTeamId : m.awayTeamId)} win on pens.`);
        } else {
          decision = (home > away) ? 'homeET' : 'awayET';
          add(120, `AET: ${this.nameOf(m.homeTeamId)} ${home}–${away} ${this.nameOf(m.awayTeamId)}.`);
        }
      } else {
        decision = home > away ? 'home' : 'away';
      }

      await this.afs.doc(`matches/${m.id}`).update({
        homeScore: home,
        awayScore: away,
        goals: events,
        commentary: lines,
        decision,
        status: 'completed',
        updatedAt: Date.now()
      });

      this.snack.open('Match played with full commentary ✔', 'OK', {duration: 2000});
    } catch (e: any) {
      console.error(e);
      this.snack.open(e?.message ?? 'Play failed', 'Close', {duration: 4000});
    } finally {
      this.busy = false;
    }
  }

  private async getTeam(id: string): Promise<Team | undefined> {
    const snap = await firstValueFrom(
      this.afs.doc<Team>(`federations/${id}`).valueChanges().pipe(take(1))
    );
    return snap ? ({...snap, id} as Team) : undefined;
  }

  private sideName(side: Side, m: Match) {
    return side === 'home' ? this.nameOf(m.homeTeamId) : this.nameOf(m.awayTeamId);
  }

  private pickScorer(team: Team) {
    const players = (team.players || []);
    const bucket = (pos: string) => players.filter(p => p.naturalPosition === pos);
    const order = [
      ...this.weight(bucket('AT'), 4),
      ...this.weight(bucket('MD'), 2),
      ...this.weight(bucket('DF'), 1),
      ...this.weight(bucket('GK'), 0.5),
    ];
    return order.length
      ? order[Math.floor(Math.random() * order.length)]
      : players[Math.floor(Math.random() * (players.length || 1))] || {id: 'unknown', name: 'Unknown'};
  }

  private weight<T>(arr: T[], factor: number) {
    const out: T[] = [];
    const copies = Math.max(1, Math.round(factor));
    arr.forEach(x => {
      for (let i = 0; i < copies; i++) out.push(x);
    });
    return out;
  }

  private genericBeat(minute: number, m: Match) {
    const opts = [
      `${this.nameOf(m.homeTeamId)} sustain pressure.`,
      `${this.nameOf(m.awayTeamId)} look dangerous on the break.`,
      `A tight midfield battle ensues.`,
      `Huge save from the keeper!`,
      `The crowd can feel a goal coming.`,
    ];
    return opts[Math.floor(Math.random() * opts.length)];
  }

  private playExtraTimeTuned(
    m: Match,
    homeTeam: Team,
    awayTeam: Team,
    h: number,
    a: number,
    events: GoalEvent[],
    add: (min: number, text: string) => void
  ) {
    add(90, `Extra time begins.`);

    const homeAtk = Math.max(10, Math.min(100, Math.round(homeTeam.rating || 60)));
    const awayAtk = Math.max(10, Math.min(100, Math.round(awayTeam.rating || 60)));

    for (let minute = 91; minute <= 120; minute++) {
      const pHome = (BASE_SHOT_RATE + (homeAtk - 50) * ATK_BONUS) * ET_RATE_MULTIPLIER;
      const pAway = (BASE_SHOT_RATE + (awayAtk - 50) * ATK_BONUS) * ET_RATE_MULTIPLIER;

      if (Math.random() < (pHome + pAway)) {
        const side: Side = pickWeightedSide(pHome, pAway);
        const isGoal = Math.random() < (GOAL_PROB * 0.9);
        if (isGoal) {
          const scorer = this.pickScorer(side === 'home' ? homeTeam : awayTeam);
          const teamId = side === 'home' ? m.homeTeamId : m.awayTeamId;
          add(minute, `GOAL in ET! ${this.nameOf(teamId)} — ${scorer.name}`);
          if (side === 'home') h++; else a++;
          events.push({minute, teamId, playerId: scorer.id!});
        } else {
          add(minute, `${this.sideName(side, m)} half-chance… blocked.`);
        }
      } else if (minute % 15 === 0 && Math.random() < 0.5) {
        add(minute, this.genericBeat(minute, m));
      }
    }
    add(120, `End of extra time: ${this.nameOf(m.homeTeamId)} ${h}–${a} ${this.nameOf(m.awayTeamId)}.`);
    return {home: h, away: a};
  }

  private playPenalties(m: Match, add: (min: number, text: string) => void): Side {
    add(120, `Penalty shootout begins.`);
    const take = () => Math.random() < 0.75;
    let h = 0, a = 0;
    for (let i = 1; i <= 5; i++) {
      const hs = take();
      h += hs ? 1 : 0;
      add(120, `${this.nameOf(m.homeTeamId)} pen ${i}: ${hs ? 'scored' : 'missed'}`);
      const as = take();
      a += as ? 1 : 0;
      add(120, `${this.nameOf(m.awayTeamId)} pen ${i}: ${as ? 'scored' : 'missed'}`);
    }
    if (h !== a) return (h > a) ? 'home' : 'away';
    let round = 6;
    while (true) {
      const hs = take();
      const as = take();
      add(120, `Sudden death ${round}: ${this.nameOf(m.homeTeamId)} ${hs ? '✓' : '✗'} — ${this.nameOf(m.awayTeamId)} ${as ? '✓' : '✗'}`);
      if (hs !== as) return hs ? 'home' : 'away';
      round++;
      if (round > 15) return Math.random() < 0.5 ? 'home' : 'away';
    }
  }
}
