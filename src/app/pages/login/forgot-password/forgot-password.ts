// src/app/pages/login/forgot-password/forgot-password.ts

import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/services/AuthService/auth';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './forgot-password.html',
  styleUrls: ['./forgot-password.scss']
})
export class ForgotPassword implements OnInit, OnDestroy {

  emailForm!: FormGroup;
  codeForm!: FormGroup;

  showCodeForm = false;
  countdown = 90;
  intervalId?: any;
  autoRedirectTimeout?: any;
  
  isLoading = false;
  email = '';
  generatedCode = '';

  showAlert = false;
  alertMessage = '';
  alertColor = 'green';

  constructor(
    private fb: FormBuilder, 
    private router: Router,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    this.emailForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]]
    });
    this.codeForm = this.fb.group({
      code: ['', [Validators.required, Validators.minLength(7), Validators.maxLength(7)]]
    });
  }

  // src/app/pages/login/forgot-password/forgot-password.ts

sendCode(): void {
  if (this.emailForm.invalid) {
    this.emailForm.markAllAsTouched();
    this.showAlertMessage('Veuillez entrer un email valide', 'orange');
    return;
  }

  this.isLoading = true;
  this.email = this.emailForm.value.email;

  this.authService.forgotPassword(this.email).subscribe({
    next: (response: any) => {
      console.log('Réponse reçue:', response);
      this.isLoading = false;
      
      // Stocker le code généré
      if (response.code) {
        this.generatedCode = response.code;
      }
      
      this.showCodeForm = true;
      this.startCountdown();
      this.showAlertMessage('Code envoyé! Vérifiez la console ou l\'alerte.', 'green', 5000);
    },
    error: (error) => {
      console.error('Erreur:', error);
      this.isLoading = false;
      this.showAlertMessage(error.message || 'Erreur lors de l\'envoi', 'red');
    }
  });
}

verifyCode(): void {
  if (this.codeForm.invalid) {
    this.codeForm.markAllAsTouched();
    this.showAlertMessage('Veuillez entrer le code à 7 caractères', 'orange');
    return;
  }

  const enteredCode = this.codeForm.value.code;
  
  if (enteredCode === this.generatedCode) {
    this.clearTimers();
    this.showAlertMessage('Code vérifié! Redirection...', 'green');
    
    setTimeout(() => {
      this.router.navigate(['/reset-password'], { queryParams: { code: enteredCode, email: this.email } });
    }, 1000);
  } else {
    this.showAlertMessage('Code incorrect', 'red');
  }
}

  resendCode(): void {
    if (!this.email) {
      this.showAlertMessage('Email non trouvé', 'red');
      return;
    }

    this.isLoading = true;
    
    this.authService.forgotPassword(this.email).subscribe({
      next: (response: any) => {
        this.isLoading = false;
        
        if (response.code) {
          this.generatedCode = response.code;
        }
        
        clearInterval(this.intervalId);
        this.startCountdown();
        this.showAlertMessage('Nouveau code envoyé!', 'green');
      },
      error: (error) => {
        this.isLoading = false;
        this.showAlertMessage(error.message || 'Erreur lors de l\'envoi', 'red');
      }
    });
  }

  startCountdown(): void {
    this.countdown = 90;
    this.intervalId = setInterval(() => {
      this.countdown--;
      if (this.countdown <= 10 && this.countdown > 0) {
        this.showAlertMessage(`Plus que ${this.countdown} secondes`, 'orange', 1000);
      }
      if (this.countdown <= 0) {
        clearInterval(this.intervalId);
        this.showAlertMessage('Session expirée - redirection vers login', 'red', 5000);
        this.autoRedirectTimeout = setTimeout(() => this.router.navigate(['/login']), 5000);
      }
    }, 1000);
  }

  showAlertMessage(msg: string, color: string, duration = 3000): void {
    this.alertMessage = msg;
    this.alertColor = color;
    this.showAlert = true;
    setTimeout(() => this.showAlert = false, duration);
  }

  onAlertClick(): void {
    this.router.navigate(['/login']);
  }

  clearTimers(): void {
    if (this.intervalId) clearInterval(this.intervalId);
    if (this.autoRedirectTimeout) clearTimeout(this.autoRedirectTimeout);
  }

  ngOnDestroy(): void {
    this.clearTimers();
  }
}