import {Component, OnInit} from '@angular/core';
import {MatDialog} from '@angular/material/dialog';
import {MatSnackBar} from '@angular/material/snack-bar';
import {Observable} from 'rxjs';
import {TeamDialogComponent} from './team-dialog.component';
import {Team} from '../../models/team';
import {TeamService} from '../../services/team.service';

@Component({
  selector: 'app-teams',
  templateUrl: './teams.component.html'
})
export class TeamsComponent implements OnInit {
  displayedColumns = ['country', 'manager', 'rating', 'actions'];

  teams$: Observable<Team[]> = this.teamSvc.list();
  teams: Team[] = [];

  constructor(
    private teamSvc: TeamService,
    private dialog: MatDialog,
    private snack: MatSnackBar
  ) {
  }

  ngOnInit(): void {
    this.teams$.subscribe(rows => (this.teams = rows || []));
  }

  add() {
    const ref = this.dialog.open(TeamDialogComponent, {
      width: '420px',
      data: {team: {country: '', manager: '', representativeEmail: ''}}
    });
    ref.afterClosed().subscribe((result?: { team: Partial<Team> }) => {
      if (result?.team?.country) {
        this.teamSvc.add(result.team as any)
          .then(() => this.snack.open('Team added', 'OK', {duration: 2000}))
          .catch(e => this.snack.open(e.message || 'Add failed', 'Close', {duration: 4000}));
      }
    });
  }

  edit(team: Team) {
    const ref = this.dialog.open(TeamDialogComponent, {width: '420px', data: {team}});
    ref.afterClosed().subscribe((result?: { team: Partial<Team> }) => {
      if (result?.team && team.id) {
        this.teamSvc.update(team.id, result.team)
          .then(() => this.snack.open('Team updated', 'OK', {duration: 2000}))
          .catch(e => this.snack.open(e.message || 'Update failed', 'Close', {duration: 4000}));
      }
    });
  }

  remove(team: Team) {
    if (!team.id) return;
    if (!confirm(`Delete ${team.country}?`)) return;
    this.teamSvc.delete(team.id)
      .then(() => this.snack.open('Team deleted', 'OK', {duration: 2000}))
      .catch(e => this.snack.open(e.message || 'Delete failed', 'Close', {duration: 4000}));
  }
}
