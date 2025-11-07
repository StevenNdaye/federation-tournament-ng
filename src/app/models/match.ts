export interface GoalEvent {
  minute: number;
  teamId: string;
  playerId: string;
}

export type MatchStatus = 'scheduled' | 'in_progress' | 'completed';

export interface Match {
  id?: string;
  tournamentId: string;
  homeTeamId: string;
  awayTeamId: string;
  homeScore: number;
  awayScore: number;
  status: MatchStatus;
  stage: 'QF' | 'SF' | 'F';
  pair: number;
  slot?: 'home' | 'away';
  kickoff?: number;
  goals: GoalEvent[];
  mode: 'play' | 'simulate';
  commentary?: string[];
  decision?: 'home' | 'away' | 'homeET' | 'awayET' | 'homePens' | 'awayPens';
  createdAt?: number;
  updatedAt?: number;
}
