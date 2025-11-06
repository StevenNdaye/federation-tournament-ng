import {Component} from '@angular/core';
import {africanCountries} from '../../utils/african-countries';
import {generatePlayers, calculateTeamRating} from '../../utils/player-generator';
import {Player} from '../../models/player';
import {Team} from '../../models/team';
import {TeamService} from '../../services/team.service';
import {MatSnackBar} from '@angular/material/snack-bar';
import {Router} from '@angular/router';

@Component({
  selector: 'app-register-federation',
  templateUrl: './register.component.html',
  styleUrls: ['./register.component.css']
})
export class RegisterFederationComponent {
  step = 1;
  countries = africanCountries;
  country = '';
  manager = '';
  representativeEmail = '';
  players: Player[] = [];
  badgeUrl = '';
  loading = false;

  badges = [
    'https://d64gsu...f353c4ed.webp', 'https://d64gsu...24ac30cf.webp',
    'https://d64gsu...7f3bb7ce.webp', 'https://d64gsu...42e9c635.webp',
    'https://d64gsu...d1e7985c.webp', 'https://d64gsu...f3dca31a.webp'
  ];

  constructor(private teams: TeamService, private snack: MatSnackBar, private router: Router) {
  }

  generate() {
    this.players = generatePlayers();
    this.step = 2;
  }

  pickCaptain(i: number) {
    this.players = this.players.map((p, idx) => ({...p, isCaptain: idx === i}));
  }

  async submit() {
    if (!this.country || !this.manager || this.players.length !== 23) {
      this.snack.open('Please complete all steps', 'Close', {duration: 3000});
      return;
    }
    this.loading = true;
    try {
      const rating = calculateTeamRating(this.players);
      const team: Team = {
        country: this.country,
        manager: this.manager,
        representativeEmail: this.representativeEmail || undefined,
        badgeUrl: this.badgeUrl || undefined,
        rating,
        players: this.players
      };
      await this.teams.add(team);
      this.snack.open('Federation registered!', 'OK', {duration: 2000});
      this.router.navigateByUrl('/teams');
    } catch (e: any) {
      this.snack.open(e?.message || 'Registration failed', 'Close', {duration: 4000});
    } finally {
      this.loading = false;
    }
  }
}
