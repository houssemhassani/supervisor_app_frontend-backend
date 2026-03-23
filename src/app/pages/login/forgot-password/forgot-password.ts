import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

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
  verificationCode = '';

  showAlert = false;
  alertMessage = '';
  alertColor = 'green';

  constructor(private fb: FormBuilder, private router: Router) {}

  ngOnInit(): void {
    this.emailForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]]
    });
    this.codeForm = this.fb.group({
      code: ['', [Validators.required]]
    });
  }

  sendCode(): void {
    if (this.emailForm.invalid) {
      this.showAlertMessage('Enter a valid email', 'orange');
      return;
    }

    this.verificationCode = Math.floor(1000 + Math.random() * 9000).toString();
    this.showCodeForm = true;
    this.startCountdown();
    this.showAlertMessage('Code sent successfully', 'green');
  }

  startCountdown(): void {
    this.countdown = 90;
    this.intervalId = setInterval(() => {
      this.countdown--;
      if (this.countdown <= 10 && this.countdown > 0) {
        this.showAlertMessage(`Only ${this.countdown}s left`, 'orange', 1000);
      }
      if (this.countdown <= 0) {
        clearInterval(this.intervalId);
        this.showAlertMessage('Session expired - click to login', 'red', 5000);
        this.autoRedirectTimeout = setTimeout(() => this.router.navigate(['/login']), 5000);
      }
    }, 1000);
  }

  verifyCode(): void {
    if (this.codeForm.value.code === this.verificationCode) {
      this.clearTimers();
      this.showAlertMessage('Code verified!', 'green');
    } else {
      this.showAlertMessage('Incorrect code', 'red');
    }
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