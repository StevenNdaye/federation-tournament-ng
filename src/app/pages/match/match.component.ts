import {Component, OnInit} from '@angular/core';
import {ActivatedRoute} from '@angular/router';
import {MatchService} from '../../services/match.service';
import {Match} from '../../models/match';
import {TeamService} from '../../services/team.service';
import {Team} from '../../models/team';
import {MatSnackBar} from '@angular/material/snack-bar';

@Component({
  selector: 'app-match',
  templateUrl: './match.component.html',
  styleUrls: ['./match.component.css']
})
export class MatchComponent implements OnInit {
  match?: Match;
  home?: Team;
  away?: Team;
  loading = false;

  constructor(
    private route: ActivatedRoute,
    private matches: MatchService,
    private teams: TeamService,
    private snack: MatSnackBar
  ) {
  }

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id')!;
    this.matches.get(id).subscribe(m => {
      this.match = m || undefined;
      if (m?.homeTeamId) this.teams.get(m.homeTeamId).subscribe(t => this.home = t || undefined);
      if (m?.awayTeamId) this.teams.get(m.awayTeamId).subscribe(t => this.away = t || undefined);
    });
  }

  async simulate() {
    if (!this.match) return;
    this.loading = true;
    try {
      const homeScore = Math.floor(Math.random() * 5);
      const awayScore = Math.floor(Math.random() * 5);
      // Ensure a decision for auto-advance
      let decision: Match['decision'] | undefined;
      if (homeScore === awayScore) decision = Math.random() < 0.5 ? 'homePens' : 'awayPens';
      else decision = homeScore > awayScore ? 'home' : 'away';

      await this.matches.update(this.match.id!, {
        homeScore, awayScore, status: 'completed', mode: 'simulate',
        goals: [], commentary: [], decision
      });
      this.snack.open('Simulated & completed. Auto-advance will run.', 'OK', {duration: 2500});
    } finally {
      this.loading = false;
    }
  }

  async play() {
    if (!this.match) return;
    this.loading = true;
    try {
      const commentary: string[] = [];
      const goals: { minute: number, teamId: string, playerId: string }[] = [];
      const minuteEvents = [5, 12, 19, 27, 34, 41, 52, 60, 68, 75, 82, 88];

      let homeGoals = 0, awayGoals = 0;

      for (const m of minuteEvents) {
        if (Math.random() < 0.20) {
          const atk = Math.random() < 0.5 ? 'home' : 'away';
          commentary.push(`${m}' Big chance for the ${atk} side!`);
          if (Math.random() < 0.40) {
            const teamId = atk === 'home' ? this.match.homeTeamId : this.match.awayTeamId;
            goals.push({minute: m, teamId, playerId: 'unknown'});
            if (atk === 'home') homeGoals++; else awayGoals++;
            commentary.push(`${m}' GOAL! ${atk === 'home' ? 'Home' : 'Away'} side scores!`);
          }
        }
      }
      commentary.push(`90' Full time: ${homeGoals}-${awayGoals}.`);

      let decision: Match['decision'] | undefined;

      if (homeGoals === awayGoals) {
        commentary.push('Match goes to Extra Time.');
        if (Math.random() < 0.5) {
          const atk = Math.random() < 0.5 ? 'home' : 'away';
          const minute = 105 + Math.floor(Math.random() * 15);
          const teamId = atk === 'home' ? this.match.homeTeamId : this.match.awayTeamId;
          goals.push({minute, teamId, playerId: 'unknown'});
          if (atk === 'home') homeGoals++; else awayGoals++;
          commentary.push(`${minute}' Extra Time GOAL for the ${atk} side!`);
          decision = atk === 'home' ? 'homeET' : 'awayET';
          commentary.push(`120' ET ends: ${homeGoals}-${awayGoals}.`);
        } else {
          commentary.push('No goals in Extra Time. We go to penalties.');
          const pensWinner = Math.random() < 0.5 ? 'home' : 'away';
          decision = pensWinner === 'home' ? 'homePens' : 'awayPens';
          commentary.push(`Penalties: ${pensWinner === 'home' ? 'Home' : 'Away'} wins the shootout!`);
        }
      } else {
        decision = homeGoals > awayGoals ? 'home' : 'away';
      }

      await this.matches.update(this.match.id!, {
        homeScore: homeGoals,
        awayScore: awayGoals,
        status: 'completed',
        mode: 'play',
        goals,
        commentary,
        decision
      });

      this.snack.open('Played & completed. Auto-advance created/updated next round.', 'OK', {duration: 3000});
    } finally {
      this.loading = false;
    }
  }
}
