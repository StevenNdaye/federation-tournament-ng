export type Position = 'GK' | 'DF' | 'MD' | 'AT';

export interface PlayerRatings {
  GK: number;
  DF: number;
  MD: number;
  AT: number;
}

export interface Player {
  id: string;
  name: string;
  naturalPosition: Position;
  ratings: PlayerRatings;
  isCaptain: boolean;
}
