import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/services/AuthService/auth';

type Role = 'admin' | 'manager' | 'employee';

@Component({
  selector: 'app-login-page',
  standalone: true,
  templateUrl: './login-page.html',
  styleUrls: ['./login-page.scss'],
  imports: [CommonModule, ReactiveFormsModule]
})
export class LoginPage implements OnInit, OnDestroy {

  loginForm!: FormGroup;
  selectedRole: Role = 'admin';
  
  // Horloge numérique
  hours: string = '';
  minutes: string = '';
  seconds: string = '';
  
  // États
  isLoading: boolean = false;
  errorMessage: string = '';
  
  private clockInterval: any;

  constructor(
    private fb: FormBuilder,
    private router: Router,
    private authService: AuthService
  ) {}

  goToForgotPassword(): void {
    this.router.navigate(['/forgot-password']);
  }

  ngOnInit(): void {
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]]
    });

    this.startClock();
    
    // Rediriger si déjà connecté
    if (this.authService.isAuthenticated()) {
      const role = this.authService.getUserRole();
      this.redirectByRole(role);
    }
  }

  ngOnDestroy(): void {
    if (this.clockInterval) {
      clearInterval(this.clockInterval);
    }
  }

  changeRole(role: Role): void {
    this.selectedRole = role;
  }

  // login-page.ts
// login-page.ts - Modifiez la méthode login()
login(): void {
  if (this.loginForm.invalid) {
    this.loginForm.markAllAsTouched();
    return;
  }

  this.isLoading = true;
  this.errorMessage = '';
  this.loginForm.disable();

  const { email, password } = this.loginForm.value;

  console.log('🔵 Tentative de connexion avec:', { email, password });

  this.authService.login(email, password).subscribe({
    next: (response) => {
      console.log('🟢 Connexion réussie!', response);
      
      // 🔥 Récupérer le rôle depuis localStorage
      const role = localStorage.getItem('userRole') || 'employee';
      console.log(`🎭 Rôle pour redirection: ${role}`);
      
      this.isLoading = false;
      this.loginForm.enable();
      
      // 🔥 Redirection manuelle
      setTimeout(() => {
        window.location.href = `/${role}/dashboard`;
      }, 100);
    },
    error: (error) => {
      console.log('🔴 Erreur de connexion:', error);
      this.isLoading = false;
      this.loginForm.enable();
      this.errorMessage = error.message || 'Email ou mot de passe incorrect';
    }
  });
}

  get email() { return this.loginForm.get('email'); }
  get password() { return this.loginForm.get('password'); }

  get emailError(): string {
    if (this.email?.errors?.['required']) return 'Email is required';
    if (this.email?.errors?.['email']) return 'Please enter a valid email address';
    return '';
  }

  get passwordError(): string {
    if (this.password?.errors?.['required']) return 'Password is required';
    if (this.password?.errors?.['minlength']) return 'Password must be at least 6 characters';
    return '';
  }

  startClock(): void {
    this.updateClock();
    this.clockInterval = setInterval(() => {
      this.updateClock();
    }, 1000);
  }

  private updateClock(): void {
    const now = new Date();
    this.hours = String(now.getHours()).padStart(2, '0');
    this.minutes = String(now.getMinutes()).padStart(2, '0');
    this.seconds = String(now.getSeconds()).padStart(2, '0');
  }

  private redirectByRole(role: string | null): void {
    if (!role) return;
    
    switch (role.toUpperCase()) {
      case 'ADMIN':
        this.router.navigate(['/admin/dashboard']);
        break;
      case 'MANAGER':
        this.router.navigate(['/manager/dashboard']);
        break;
      case 'EMPLOYEE':
        this.router.navigate(['/employee/dashboard']);
        break;
      default:
        this.router.navigate(['/dashboard']);
    }
  }
}