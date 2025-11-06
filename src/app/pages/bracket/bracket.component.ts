import {Component, OnInit} from '@angular/core';
import {Team} from '../../models/team';
import {TeamService} from '../../services/team.service';
import {BracketService} from '../../services/bracket.service';
import {MatSnackBar} from '@angular/material/snack-bar';
import {MatchService} from '../../services/match.service';
import {Observable} from 'rxjs';
import {Match} from '../../models/match';

@Component({
  selector: 'app-bracket',
  templateUrl: './bracket.component.html',
  styleUrls: ['./bracket.component.css']
})
export class BracketComponent implements OnInit {
  teams: Team[] = [];
  qf$: Observable<Match[]> = this.matches.listByStage('QF');
  sf$: Observable<Match[]> = this.matches.listByStage('SF');
  f$: Observable<Match[]> = this.matches.listByStage('F');

  constructor(
    private teamSvc: TeamService,
    private bracket: BracketService,
    private matches: MatchService,
    private snack: MatSnackBar
  ) {
  }

  ngOnInit(): void {
    this.teamSvc.list().subscribe(ts => this.teams = ts || []);
  }

  async startTournament() {
    try {
      await this.bracket.seedQuarterFinals(this.teams);
      this.snack.open('Quarter Finals seeded!', 'OK', {duration: 2000});
    } catch (e: any) {
      this.snack.open(e?.message || 'Unable to start', 'Close', {duration: 4000});
    }
  }
}
