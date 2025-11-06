import {Injectable} from '@angular/core';
import {CanActivate, Router} from '@angular/router';
import {AuthService} from '../services/auth.service';
import {map, tap} from 'rxjs/operators';

@Injectable({providedIn: 'root'})
export class AdminGuard implements CanActivate {
  constructor(private auth: AuthService, private router: Router) {
  }

  canActivate() {
    return this.auth.role$.pipe(
      map(role => role === 'admin'),
      tap(ok => {
        if (!ok) this.router.navigateByUrl('/');
      })
    );
  }
}
