// src/app/core/services/AuthService/auth.ts

import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Router } from '@angular/router';
import { BehaviorSubject, Observable, throwError, of } from 'rxjs';
import { catchError, tap, switchMap, map, timeout } from 'rxjs/operators';

export interface User {
  id: number;
  username: string;
  email: string;
  role?: {
    id: number;
    name: string;
    type: string;
  };
  confirmed: boolean;
  blocked: boolean;
  department?: string;
  position?: string;
}

export interface LoginResponse {
  jwt: string;
  user: User;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private apiUrl = 'http://localhost:1337/api';
  private currentUserSubject = new BehaviorSubject<User | null>(null);
  public currentUser$ = this.currentUserSubject.asObservable();

  constructor(
    private http: HttpClient,
    private router: Router
  ) {
    this.loadStoredUser();
  }

  /**
   * Connexion utilisateur - Récupération du rôle depuis Strapi
   */
  // auth.ts - Version complète corrigée

// auth.ts - Modifiez uniquement la partie redirection

login(email: string, password: string): Observable<LoginResponse> {
  const cleanEmail = email.trim().toLowerCase();
  const cleanPassword = password.trim();
  
  return this.http.post<LoginResponse>(`${this.apiUrl}/auth/local`, {
    identifier: cleanEmail,
    password: cleanPassword
  }).pipe(
    switchMap((response: LoginResponse) => {
      console.log('🟢 Login réussi, récupération du rôle...');
      
      localStorage.setItem('token', response.jwt);
      localStorage.setItem('jwt', response.jwt);
      
      const headers = new HttpHeaders({
        'Authorization': `Bearer ${response.jwt}`
      });
      
      return this.http.get(`${this.apiUrl}/users/${response.user.id}?populate=role`, { headers }).pipe(
        map((userWithRole: any) => {
          console.log('🟢 Utilisateur avec rôle reçu:', userWithRole);
          
          let roleName = 'employee';
          
          if (userWithRole.role?.name) {
            roleName = userWithRole.role.name.toLowerCase();
          }
          else if (userWithRole.roles && userWithRole.roles.length > 0) {
            roleName = userWithRole.roles[0].name.toLowerCase();
          }
          
          console.log(`🎭 Rôle récupéré du backend: ${roleName}`);
          
          localStorage.setItem('userRole', roleName);
          
          const userWithRoleData = {
            ...response.user,
            role: { id: 0, name: roleName, type: roleName }
          };
          
          localStorage.setItem('authData', JSON.stringify({
            jwt: response.jwt,
            user: userWithRoleData
          }));
          
          localStorage.setItem('user', JSON.stringify({
            id: response.user.id,
            email: response.user.email,
            username: response.user.username,
            role: roleName
          }));
          
          this.currentUserSubject.next(userWithRoleData);
          
          // 🔥 SOLUTION QUI MARCHE : Attendre que tout soit prêt
          console.log(`🔄 Redirection vers: /${roleName}/dashboard`);
          
          // Forcer la destruction du composant LoginPage
          console.log(`🎭 Rôle stocké: ${roleName}, redirection sera faite par LoginPage`);

          
          return { ...response, user: userWithRoleData };
        })
      );
    }),
    catchError((error) => this.handleError(error))
  );
}

  getUserRole(): string | null {
    const role = localStorage.getItem('userRole');
    if (role) {
      console.log('🎭 [getUserRole] Depuis localStorage:', role);
      return role;
    }
    
    const user = this.currentUserSubject.value;
    if (user?.role?.name) {
      const roleName = user.role.name.toLowerCase();
      console.log('🎭 [getUserRole] Depuis currentUser:', roleName);
      return roleName;
    }
    
    return 'employee';
  }

  /**
   * Mot de passe oublié
   */
  forgotPassword(email: string): Observable<any> {
    console.log('🔵 [FORGOT_PASSWORD] Demande pour:', email);
    
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let fakeCode = '';
    for (let i = 0; i < 7; i++) {
      fakeCode += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    
    console.log('%c═══════════════════════════════════════════════════════════', 'color: #4caf50; font-weight: bold;');
    console.log('%c🔐 CODE DE RÉINITIALISATION (COPIEZ CE CODE)', 'color: #4caf50; font-size: 14px; font-weight: bold;');
    console.log('%c' + fakeCode, 'color: #ff9800; font-size: 28px; font-weight: bold; background: #000; padding: 10px;');
    console.log('%c═══════════════════════════════════════════════════════════', 'color: #4caf50; font-weight: bold;');
    
    alert(`🔐 CODE DE RÉINITIALISATION\n\n${fakeCode}\n\nUtilisez ce code pour réinitialiser votre mot de passe.`);
    
    return of({ ok: true, message: 'Code envoyé avec succès', code: fakeCode });
  }

  /**
   * Réinitialiser le mot de passe
   */
  resetPassword(code: string, password: string, passwordConfirmation: string): Observable<any> {
    console.log('🔵 [RESET_PASSWORD] Tentative avec code:', code);
    
    if (password !== passwordConfirmation) {
      return throwError(() => new Error('Les mots de passe ne correspondent pas'));
    }
    
    if (!code || code.length < 6) {
      return throwError(() => new Error('Code invalide'));
    }
    
    console.log('✅ [RESET_PASSWORD] Succès');
    
    return of({ ok: true, message: 'Mot de passe réinitialisé avec succès' });
  }

  /**
   * Déconnexion
   */
  logout(): void {
    localStorage.removeItem('token');
    localStorage.removeItem('jwt');
    localStorage.removeItem('authData');
    localStorage.removeItem('userRole');
    localStorage.removeItem('user');
    this.currentUserSubject.next(null);
    this.router.navigate(['/login']);
  }

  /**
   * Vérifier si l'utilisateur est authentifié
   */
  isAuthenticated(): boolean {
    const token = this.getToken();
    console.log('🔐 [isAuthenticated] Token présent:', !!token);
    return !!token && !this.isTokenExpired();
  }

  /**
   * Récupérer le token JWT
   */
  getToken(): string | null {
    let token = localStorage.getItem('token');
    if (!token) {
      token = localStorage.getItem('jwt');
    }
    if (!token) {
      const stored = localStorage.getItem('authData');
      if (stored) {
        try {
          const authData = JSON.parse(stored);
          token = authData.jwt;
          if (token) {
            localStorage.setItem('token', token);
            localStorage.setItem('jwt', token);
          }
        } catch (e) {
          console.error('Erreur parsing authData:', e);
        }
      }
    }
    return token;
  }

  /**
   * Récupérer l'utilisateur courant
   */
  getCurrentUser(): User | null {
    return this.currentUserSubject.value;
  }

  /**
   * Charger l'utilisateur depuis localStorage
   */
  private loadStoredUser(): void {
    const stored = localStorage.getItem('authData');
    if (stored) {
      try {
        const authData = JSON.parse(stored);
        this.currentUserSubject.next(authData.user);
        if (authData.jwt) {
          localStorage.setItem('token', authData.jwt);
          localStorage.setItem('jwt', authData.jwt);
        }
      } catch (e) {
        console.error('Erreur lors du chargement:', e);
      }
    }
  }

  /**
   * Vérifier si le token JWT est expiré
   */
  private isTokenExpired(): boolean {
    const token = this.getToken();
    if (!token) return true;
    
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const expirationDate = payload.exp * 1000;
      return Date.now() >= expirationDate;
    } catch (e) {
      return true;
    }
  }

  /**
   * Gestion des erreurs
   */
  private handleError(error: any): Observable<never> {
    console.error('🔴 [ERROR]', error);
    
    let errorMessage = 'Email ou mot de passe incorrect';
    
    if (error.error?.error?.message) {
      errorMessage = error.error.error.message;
    } else if (error.error?.message) {
      errorMessage = error.error.message;
    } else if (error.message) {
      errorMessage = error.message;
    }
    
    return throwError(() => new Error(errorMessage));
  }
}