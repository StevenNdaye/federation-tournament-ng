import {Player, Position, PlayerRatings} from '../models/player';

const FIRST = ['Ahmed', 'Mohamed', 'Kwame', 'Kofi', 'Youssef', 'Samuel', 'Didier', 'Victor', 'Michael', 'Andre', 'Pierre', 'Eric', 'Wilfried', 'Nicolas'];
const LAST = ['Salah', 'Mané', 'Mahrez', 'Osimhen', 'Eto\'o', 'Koulibaly', 'Mendy', 'Partey', 'Keita', 'Traoré', 'Diallo', 'Toure', 'Aboubakar', 'Ziyech'];

const TEMPLATE: Position[] = ['GK', 'GK', 'DF', 'DF', 'DF', 'DF', 'DF', 'MD', 'MD', 'MD', 'MD', 'MD', 'AT', 'AT', 'AT', 'AT', 'AT', 'DF', 'MD', 'AT', 'DF', 'MD', 'AT'];

function randi(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function rating(nat: boolean) {
  return nat ? randi(50, 100) : randi(0, 50);
}

function genRatings(natural: Position): PlayerRatings {
  return {
    GK: rating(natural === 'GK'),
    DF: rating(natural === 'DF'),
    MD: rating(natural === 'MD'),
    AT: rating(natural === 'AT')
  };
}

export function generatePlayers(captainIndex = 10): Player[] {
  const now = Date.now();
  return TEMPLATE.map((pos, i) => {
    const name = `${FIRST[randi(0, FIRST.length - 1)]} ${LAST[randi(0, LAST.length - 1)]}`;
    return {
      id: `P-${now}-${i}`,
      name,
      naturalPosition: pos,
      ratings: genRatings(pos),
      isCaptain: i === captainIndex
    };
  });
}

export function calculateTeamRating(players: Player[]): number {
  if (!players.length) return 0;
  const total = players.reduce((acc, p) => {
    const nat = p.naturalPosition;
    const avg = (p.ratings.GK + p.ratings.DF + p.ratings.MD + p.ratings.AT) / 4;
    const natScore = p.ratings[nat];
    return acc + (natScore * 0.7 + avg * 0.3);
  }, 0);
  return Math.round(total / players.length);
}
