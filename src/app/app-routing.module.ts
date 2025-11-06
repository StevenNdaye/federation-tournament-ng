import {NgModule} from '@angular/core';
import {RouterModule, Routes} from '@angular/router';

import {HomeComponent} from './pages/home/home.component';
import {TeamsComponent} from './pages/teams/teams.component';        // your existing
import {BracketComponent} from './pages/bracket/bracket.component';
import {MatchComponent} from './pages/match/match.component';
import {ScorersComponent} from './pages/scorers/scorers.component';
import {AuthGuard} from './guards/auth.guard';
import {AdminGuard} from './guards/admin.guard';
import {RegisterFederationComponent} from "./pages/register/register.component";

const routes: Routes = [
  {path: '', component: HomeComponent},
  {path: 'bracket', component: BracketComponent},       // public
  {path: 'match/:id', component: MatchComponent},       // public
  {path: 'scorers', component: ScorersComponent},       // public
  {path: 'register', component: RegisterFederationComponent, canActivate: [AuthGuard]},
  {path: 'teams', component: TeamsComponent, canActivate: [AuthGuard]},
  // { path: 'admin', component: AdminComponent, canActivate: [AdminGuard] }, // optional
  {path: '**', redirectTo: ''}
];

@NgModule({imports: [RouterModule.forRoot(routes)], exports: [RouterModule]})
export class AppRoutingModule {
}
