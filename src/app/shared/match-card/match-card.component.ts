import {Component, Input} from '@angular/core';
import {Match} from '../../models/match';
import {Router} from '@angular/router';
import {TeamService} from '../../services/team.service';
import {Team} from '../../models/team';

@Component({
  selector: 'app-match-card',
  templateUrl: './match-card.component.html',
  styleUrls: ['./match-card.component.css']
})
export class MatchCardComponent {
  @Input() match!: Match;
  teams: Team[] = [];

  constructor(private router: Router, teamSvc: TeamService) {
    teamSvc.list().subscribe(ts => this.teams = ts || []);
  }

  nameOf(id?: string) {
    return this.teams.find(t => t.id === id)?.country || id || '—';
  }

  open() {
    if (this.match?.id) this.router.navigate(['/match', this.match.id]);
  }

  private winnerOf(m: Match): 'home' | 'away' | null {
    if (!m || m.status !== 'completed') return null;

    if (m.homeScore !== m.awayScore) {
      return m.homeScore > m.awayScore ? 'home' : 'away';
    }
    if (m.decision) {
      return m.decision.startsWith('home') ? 'home' : 'away';
    }
    return null; // should not happen if UI enforces a decision
  }

  outcomeClass(side: 'home' | 'away') {
    const w = this.winnerOf(this.match);
    if (!w) return {};
    return {
      win: w === side,
      lose: w !== side
    };
  }
}
