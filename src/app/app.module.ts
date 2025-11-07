import {NgModule} from '@angular/core';
import {BrowserModule} from '@angular/platform-browser';
import {BrowserAnimationsModule} from '@angular/platform-browser/animations';
import {FormsModule, ReactiveFormsModule} from '@angular/forms';
import {AngularFireModule} from '@angular/fire/compat';
import {AngularFirestoreModule} from '@angular/fire/compat/firestore';
import {AngularFireAuthModule} from '@angular/fire/compat/auth';
import {AppRoutingModule} from './app-routing.module';
import {MaterialModule} from './material.module';
import {environment} from '../environments/environment';
import {AppComponent} from './app.component';
import {NavbarComponent} from './shared/navbar/navbar.component';
import {HomeComponent} from './pages/home/home.component';
import {TeamsComponent} from './pages/teams/teams.component';
import {TeamDialogComponent} from './pages/teams/team-dialog.component';
import {BracketComponent} from './pages/bracket/bracket.component';
import {MatchComponent} from './pages/match/match.component';
import {ScorersComponent} from './pages/scorers/scorers.component';
import {RegisterFederationComponent} from "./pages/register/register.component";
import {LoginComponent} from "./auth/login/login.component";
import {AdminComponent} from './pages/admin/admin.component';
import {RouterModule} from "@angular/router";
import {MatchCardComponent} from "./shared/match-card/match-card.component";

@NgModule({
  declarations: [
    AppComponent, NavbarComponent, HomeComponent,
    RegisterFederationComponent, TeamsComponent, TeamDialogComponent,
    BracketComponent, MatchComponent, MatchCardComponent, ScorersComponent,
    LoginComponent,
    AdminComponent
  ],
  imports: [
    BrowserModule, BrowserAnimationsModule, FormsModule, ReactiveFormsModule,
    MaterialModule, RouterModule,
    AngularFireModule.initializeApp(environment.firebase),
    AngularFirestoreModule, AngularFireAuthModule,
    AppRoutingModule
  ],
  bootstrap: [AppComponent]
})
export class AppModule {
}
