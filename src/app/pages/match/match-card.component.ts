import {Component, Input} from '@angular/core';
import {Match} from '../../models/match';

@Component({
  selector: 'app-match-card',
  template: `
    <div class="mc">
      <div class="row"><span>Stage:</span><b>{{ match.stage }}</b></div>
      <div class="row"><span>Home:</span><b>{{ match.homeTeamId }}</b> <b>{{ match.homeScore }}</b></div>
      <div class="row"><span>Away:</span><b>{{ match.awayTeamId }}</b> <b>{{ match.awayScore }}</b></div>
      <div class="row"><span>Status:</span>{{ match.status }}</div>
    </div>`,
  styles: [`.mc {
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    padding: 8px;
  }

  .row {
    display: flex;
    gap: 8px;
  }`]
})
export class MatchCardComponent {
  @Input() match!: Match;
}
