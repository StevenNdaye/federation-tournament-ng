import {Component, EventEmitter, Input, Output} from '@angular/core';
import {Router} from '@angular/router';

@Component({
  selector: 'app-navbar',
  templateUrl: './navbar.component.html',
  styleUrls: ['./navbar.component.css']
})
export class NavbarComponent {
  @Input() email: string | null = null;
  @Output() logout = new EventEmitter<void>();

  constructor(private router: Router) {
  }

  go(p: string) {
    this.router.navigateByUrl(p);
  }
}
