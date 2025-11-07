import {Component} from '@angular/core';
import {africanCountries} from '../../utils/african-countries';
import {calculateTeamRating, generatePlayers} from '../../utils/player-generator';
import {Player} from '../../models/player';
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
    'https://flagcdn.com/w160/gh.png', // Ghana
    'https://flagcdn.com/w160/ng.png', // Nigeria
    'https://flagcdn.com/w160/za.png', // South Africa
    'https://flagcdn.com/w160/eg.png', // Egypt
    'https://flagcdn.com/w160/ma.png', // Morocco
    'https://flagcdn.com/w160/sn.png', // Senegal
    'https://flagcdn.com/w160/dz.png', // Algeria
    'https://flagcdn.com/w160/cm.png', // Cameroon
  ];

  constructor(
    private teams: TeamService,
    private snack: MatSnackBar,
    private router: Router
  ) {
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

      const team: any = {
        country: this.country,
        manager: this.manager,
        rating,
        players: this.players,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      if (this.representativeEmail?.trim()) {
        team.representativeEmail = this.representativeEmail.trim();
      }
      if (this.badgeUrl) {
        team.badgeUrl = this.badgeUrl;
      }

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
