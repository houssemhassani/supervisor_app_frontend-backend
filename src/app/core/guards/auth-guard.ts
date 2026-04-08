// src/app/core/guards/auth-guard.ts
import { Injectable } from '@angular/core';
import { Router, CanActivate } from '@angular/router';
import { AuthService } from '../services/AuthService/auth';

@Injectable({
  providedIn: 'root'
})
export class AuthGuard implements CanActivate {
  
  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  canActivate(): boolean {
    const isAuthenticated = this.authService.isAuthenticated();
    console.log('🛡️ [AuthGuard] Authentifié:', isAuthenticated);
    
    if (isAuthenticated) {
      return true;
    }
    
    console.log('🔴 Non authentifié, redirection vers login');
    this.router.navigate(['/login']);
    return false;
  }
}