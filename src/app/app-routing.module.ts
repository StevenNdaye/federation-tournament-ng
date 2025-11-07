import {NgModule} from '@angular/core';
import {RouterModule, Routes} from '@angular/router';

import {HomeComponent} from './pages/home/home.component';
import {TeamsComponent} from './pages/teams/teams.component'; // your existing
import {BracketComponent} from './pages/bracket/bracket.component';
import {MatchComponent} from './pages/match/match.component';
import {ScorersComponent} from './pages/scorers/scorers.component';
import {AuthGuard} from './guards/auth.guard';
import {RegisterFederationComponent} from "./pages/register/register.component";
import {AdminGuard} from "./guards/admin.guard";
import {LoginComponent} from "./auth/login/login.component";
import {AdminComponent} from "./pages/admin/admin.component";

const routes: Routes = [
  {path: '', component: HomeComponent},
  {path: 'login', component: LoginComponent},
  {path: 'bracket', component: BracketComponent},
  {path: 'match/:id', component: MatchComponent},
  {path: 'scorers', component: ScorersComponent},
  {path: 'register', component: RegisterFederationComponent, canActivate: [AuthGuard]},
  {path: 'teams', component: TeamsComponent, canActivate: [AuthGuard]},
  {path: 'admin', component: AdminComponent, canActivate: [AdminGuard]},
  {path: '**', redirectTo: ''}
];

@NgModule({imports: [RouterModule.forRoot(routes, {scrollPositionRestoration: 'enabled'})], exports: [RouterModule]})
export class AppRoutingModule {
}
