// src/app/pages/reset-password/reset-password.ts

import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, AbstractControl, ValidationErrors } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { AuthService } from '../../../core/services/AuthService/auth';

function passwordMatchValidator(control: AbstractControl): ValidationErrors | null {
  const password = control.get('password');
  const confirmPassword = control.get('confirmPassword');
  
  if (password && confirmPassword && password.value !== confirmPassword.value) {
    return { passwordMismatch: true };
  }
  return null;
}

function passwordStrengthValidator(control: AbstractControl): ValidationErrors | null {
  const password = control.value;
  if (!password) return null;
  
  const hasUpperCase = /[A-Z]/.test(password);
  const hasLowerCase = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasMinLength = password.length >= 8;
  
  if (!hasMinLength) return { minLength: true };
  if (!hasUpperCase) return { noUpperCase: true };
  if (!hasLowerCase) return { noLowerCase: true };
  if (!hasNumber) return { noNumber: true };
  return null;
}

@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './reset-password.html',
  styleUrls: ['./reset-password.scss']
})
export class ResetPasswordComponent implements OnInit, OnDestroy {
  
  resetForm!: FormGroup;
  isLoading: boolean = false;
  isSuccess: boolean = false;
  errorMessage: string = '';
  submitted: boolean = false;
  code: string = '';
  email: string = '';
  
  showPassword: boolean = false;
  showConfirmPassword: boolean = false;
  
  passwordStrength: number = 0;
  passwordStrengthText: string = '';
  passwordStrengthColor: string = '';
  
  hours: string = '';
  minutes: string = '';
  private clockInterval: any;

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private route: ActivatedRoute,
    private router: Router
  ) {
    this.resetForm = this.fb.group({
      password: ['', [
        Validators.required,
        Validators.minLength(8),
        passwordStrengthValidator
      ]],
      confirmPassword: ['', [Validators.required]]
    }, { validators: passwordMatchValidator });
  }

  ngOnInit(): void {
    this.route.queryParams.subscribe(params => {
      this.code = params['code'] || '';
      this.email = params['email'] || '';
      
      if (!this.code) {
        this.errorMessage = 'Code de réinitialisation invalide ou manquant';
      }
    });
    
    this.startClock();
    
    this.resetForm.get('password')?.valueChanges.subscribe(value => {
      this.updatePasswordStrength(value);
    });
  }

  ngOnDestroy(): void {
    if (this.clockInterval) {
      clearInterval(this.clockInterval);
    }
  }

  onSubmit(): void {
    this.submitted = true;
    
    if (this.resetForm.invalid || !this.code) {
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';
    this.resetForm.disable();

    const { password, confirmPassword } = this.resetForm.value;

    this.authService.resetPassword(this.code, password, confirmPassword).subscribe({
      next: (response) => {
        console.log('✅ Réinitialisation réussie:', response);
        this.isLoading = false;
        this.isSuccess = true;
        this.resetForm.enable();
        
        // Redirection vers login après 3 secondes
        setTimeout(() => {
          this.router.navigate(['/login']);
        }, 3000);
      },
      error: (error) => {
        console.error('❌ Erreur:', error);
        this.isLoading = false;
        this.resetForm.enable();
        this.errorMessage = error.message || 'Erreur lors de la réinitialisation';
      }
    });
  }

  goToLogin(): void {
    this.router.navigate(['/login']);
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
  }

  private updatePasswordStrength(password: string): void {
    if (!password) {
      this.passwordStrength = 0;
      this.passwordStrengthText = '';
      this.passwordStrengthColor = '';
      return;
    }
    
    let strength = 0;
    if (password.length >= 8) strength++;
    if (password.length >= 12) strength++;
    if (/[A-Z]/.test(password)) strength++;
    if (/[a-z]/.test(password)) strength++;
    if (/[0-9]/.test(password)) strength++;
    if (/[!@#$%^&*]/.test(password)) strength++;
    
    this.passwordStrength = Math.min(strength, 4);
    
    switch (this.passwordStrength) {
      case 1:
        this.passwordStrengthText = 'Très faible';
        this.passwordStrengthColor = '#ff4444';
        break;
      case 2:
        this.passwordStrengthText = 'Faible';
        this.passwordStrengthColor = '#ffaa44';
        break;
      case 3:
        this.passwordStrengthText = 'Moyen';
        this.passwordStrengthColor = '#44ff44';
        break;
      case 4:
        this.passwordStrengthText = 'Fort';
        this.passwordStrengthColor = '#00cc44';
        break;
      default:
        this.passwordStrengthText = 'Très faible';
        this.passwordStrengthColor = '#ff4444';
    }
  }

  get password() { return this.resetForm.get('password'); }
  get confirmPassword() { return this.resetForm.get('confirmPassword'); }
  
  get passwordError(): string {
    if (this.password?.errors?.['required']) return 'Mot de passe requis';
    if (this.password?.errors?.['minlength']) return 'Minimum 8 caractères';
    if (this.password?.errors?.['noUpperCase']) return 'Au moins une majuscule';
    if (this.password?.errors?.['noLowerCase']) return 'Au moins une minuscule';
    if (this.password?.errors?.['noNumber']) return 'Au moins un chiffre';
    return '';
  }
  
  get confirmPasswordError(): string {
    if (this.confirmPassword?.errors?.['required']) return 'Confirmation requise';
    if (this.resetForm?.errors?.['passwordMismatch']) return 'Les mots de passe ne correspondent pas';
    return '';
  }
}