import {Injectable} from '@angular/core';
import {Team} from '../models/team';
import {Match} from '../models/match';
import {MatchService} from './match.service';

@Injectable({providedIn: 'root'})
export class BracketService {
  constructor(private matches: MatchService) {
  }

  async seedQuarterFinals(teams: Team[]) {
    if (teams.length < 8) throw new Error('Need at least 8 teams to start QF');
    const selected = teams.slice(0, 8);

    const pairs: [Team, Team, number][] = [
      [selected[0], selected[7], 1],
      [selected[3], selected[4], 2],
      [selected[1], selected[6], 3],
      [selected[2], selected[5], 4],
    ];

    for (const [home, away, pair] of pairs) {
      const m: Match = {
        homeTeamId: home.id!, awayTeamId: away.id!,
        homeScore: 0, awayScore: 0,
        goals: [], status: 'scheduled', stage: 'QF', pair, mode: 'simulate'
      };
      await this.matches.create(m);
    }
  }
}
