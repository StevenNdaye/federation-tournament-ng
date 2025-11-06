import {Component} from '@angular/core';
import {FormBuilder, Validators} from '@angular/forms';
import {Router} from '@angular/router';
import {MatSnackBar} from '@angular/material/snack-bar';
import {AuthService} from "../../services/auth.service";

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css']
})
export class LoginComponent {
  loading = false;

  form = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
  });

  constructor(
    private fb: FormBuilder,
    private auth: AuthService,
    private router: Router,
    private snack: MatSnackBar
  ) {
  }

  async login() {
    if (this.form.invalid) return;
    const {email, password} = this.form.value;
    this.loading = true;
    try {
      await this.auth.signInEmail(email!, password!);
      this.router.navigateByUrl('/');
    } catch (e: any) {
      this.snack.open(e?.message ?? 'Login failed', 'Close', {duration: 4000});
    } finally {
      this.loading = false;
    }
  }

  async register() {
    if (this.form.invalid) return;
    const {email, password} = this.form.value;
    this.loading = true;
    try {
      await this.auth.registerEmail(email!, password!);
      this.router.navigateByUrl('/');
    } catch (e: any) {
      this.snack.open(e?.message ?? 'Registration failed', 'Close', {duration: 4000});
    } finally {
      this.loading = false;
    }
  }

  async google() {
    this.loading = true;
    try {
      await this.auth.google();
      this.router.navigateByUrl('/');
    } catch (e: any) {
      this.snack.open(e?.message ?? 'Google sign-in failed', 'Close', {duration: 4000});
    } finally {
      this.loading = false;
    }
  }
}
