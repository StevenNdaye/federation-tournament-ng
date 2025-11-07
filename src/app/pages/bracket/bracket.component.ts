// src/app/pages/bracket/bracket.component.ts

import {Component, OnInit} from '@angular/core';
import {Team} from '../../models/team';
import {TeamService} from '../../services/team.service';
import {BracketService} from '../../services/bracket.service';
import {MatchService} from '../../services/match.service';
import {MatSnackBar} from '@angular/material/snack-bar';
import {AngularFirestore} from '@angular/fire/compat/firestore';
import {AngularFireAuth} from '@angular/fire/compat/auth';
import {Observable, firstValueFrom} from 'rxjs';
import {Match} from '../../models/match';

@Component({
  selector: 'app-bracket',
  templateUrl: './bracket.component.html',
  styleUrls: ['./bracket.component.css']
})
export class BracketComponent implements OnInit {
  /** All registered teams (used to seed QFs) */
  teams: Team[] = [];

  /** Active tournament ID (from meta/state.activeTournamentId) */
  activeTid?: string;

  /** Streams of matches for each stage */
  qf$!: Observable<Match[]>;
  sf$!: Observable<Match[]>;
  f$!: Observable<Match[]>;

  constructor(
    private teamSvc: TeamService,
    private bracket: BracketService,
    private matches: MatchService,
    private snack: MatSnackBar,
    private afs: AngularFirestore,
    private afAuth: AngularFireAuth
  ) {
  }

  ngOnInit(): void {
    // 1️⃣ Load all registered teams
    this.teamSvc.list().subscribe(ts => (this.teams = ts || []));

    // 2️⃣ Watch the active tournament ID from meta/state
    this.afs
      .doc<{ activeTournamentId: string }>('meta/state')
      .valueChanges()
      .subscribe((s) => {
        this.activeTid = s?.activeTournamentId;
        if (this.activeTid) {
          this.qf$ = this.matches.listByStage('QF', this.activeTid);
          this.sf$ = this.matches.listByStage('SF', this.activeTid);
          this.f$ = this.matches.listByStage('F', this.activeTid);
        }
      });
  }

  /**
   * ✅ Start tournament (creates Quarter Finals if user is admin)
   */
  async startTournament() {
    try {
      // Must be logged in
      const user = await firstValueFrom(this.afAuth.authState);
      if (!user?.uid) {
        this.snack.open('Please sign in first', 'Close', {duration: 3000});
        return;
      }

      // Must be admin (check admins/{uid})
      const adminSnap = await this.afs.doc(`admins/${user.uid}`).ref.get();
      const isAdmin = adminSnap.exists;

      if (!isAdmin) {
        this.snack.open('You are not an admin. Access denied.', 'Close', {duration: 3500});
        return;
      }

      // Proceed
      await this.bracket.seedQuarterFinals(this.teams);
      this.snack.open('Quarter Finals seeded!', 'OK', {duration: 2000});
    } catch (e: any) {
      console.error('startTournament failed:', e);
      this.snack.open(e?.message || 'Unable to start tournament', 'Close', {duration: 4000});
    }
  }

  /**
   * 🆕 Start a brand new tournament (optional)
   */
  async newTournament() {
    if (!confirm('Start a brand new tournament? Existing bracket will be kept as history.')) return;

    try {
      const user = await firstValueFrom(this.afAuth.authState);
      if (!user?.uid) {
        this.snack.open('Please sign in first', 'Close', {duration: 3000});
        return;
      }

      const adminSnap = await this.afs.doc(`admins/${user.uid}`).ref.get();
      const isAdmin = adminSnap.exists;
      if (!isAdmin) {
        this.snack.open('You are not an admin. Access denied.', 'Close', {duration: 3500});
        return;
      }

      const newTid = await this.bracket.startNewTournament();
      await this.bracket.seedQuarterFinals(this.teams, {force: true});
      this.activeTid = newTid;
      this.snack.open('New tournament seeded!', 'OK', {duration: 2000});
    } catch (e: any) {
      console.error('newTournament failed:', e);
      this.snack.open('Failed to create new tournament', 'Close', {duration: 4000});
    }
  }
}
