import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

type Role = 'ADMIN' | 'MANAGER' | 'EMPLOYEE';

@Component({
  selector: 'app-login-page',
  standalone: true,
  templateUrl: './login-page.html',
  styleUrls: ['./login-page.scss'],
  imports: [CommonModule, ReactiveFormsModule]
})
export class LoginPage implements OnInit {

  loginForm!: FormGroup;
  selectedRole: Role = 'EMPLOYEE';
 now = new Date();
  // Horloge numérique
  hours: string =  String(this.now.getHours()).padStart(2,'0');
  minutes: string = String(this.now.getMinutes()).padStart(2,'0');
  seconds: string = String(this.now.getSeconds()).padStart(2,'0');

  constructor(private fb: FormBuilder,private router: Router) {}
goToForgotPassword() {
  this.router.navigate(['/forgot-password']);
}
  ngOnInit(): void {
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', Validators.required]
    });

    this.startClock();
  }

  changeRole(role: Role): void {
    this.selectedRole = role;
  }

  login(): void {
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }
    console.log({ ...this.loginForm.value, role: this.selectedRole });
    // TODO: appeler API pour login
  }

  get email() { return this.loginForm.get('email'); }
  get password() { return this.loginForm.get('password'); }

  // ================= HORLOGE =================
  startClock(): void {
    setInterval(() => {
      const now = new Date();
      this.hours = String(now.getHours()).padStart(2,'0');
      this.minutes = String(now.getMinutes()).padStart(2,'0');
      this.seconds = String(now.getSeconds()).padStart(2,'0');
    }, 1000);
  }
}