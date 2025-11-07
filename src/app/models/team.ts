import {Player} from './player';

export interface Team {
  id?: string;
  country: string;
  manager: string;
  representativeEmail?: string;
  badgeUrl?: string;
  rating: number;
  players: Player[];
  createdAt?: number;
  updatedAt?: number;
}
