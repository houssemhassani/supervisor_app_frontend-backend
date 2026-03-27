// src/app/core/services/AuthService/auth.ts

import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Router } from '@angular/router';
import { BehaviorSubject, Observable, throwError } from 'rxjs';
import { catchError, tap, switchMap, map } from 'rxjs/operators';

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
   * Connexion utilisateur
   * Endpoint: POST /api/auth/local
   */
  login(email: string, password: string): Observable<LoginResponse> {
    console.log('🔵 [LOGIN] Tentative de connexion avec:', { email, password });
    
    // Nettoyer les données
    const cleanEmail = email.trim().toLowerCase();
    const cleanPassword = password.trim();
    
    return this.http.post<LoginResponse>(`${this.apiUrl}/auth/local`, {
      identifier: cleanEmail,
      password: cleanPassword
    }).pipe(
      tap((response: LoginResponse) => {
        // STOCKER LE TOKEN IMMÉDIATEMENT APRÈS LA RÉPONSE
        console.log('🟢 [LOGIN] Réponse reçue - JWT présent:', !!response.jwt);
        if (response.jwt) {
          localStorage.setItem('token', response.jwt);
          console.log('✅ Token stocké immédiatement:', response.jwt.substring(0, 50) + '...');
        }
      }),
      switchMap((response: LoginResponse) => {
        console.log('🟢 [LOGIN] Login réussi, récupération du rôle...');
        
        const headers = new HttpHeaders({
          'Authorization': `Bearer ${response.jwt}`
        });
        
        return this.http.get(`${this.apiUrl}/users/${response.user.id}?populate=role`, { headers }).pipe(
          map((userWithRole: any) => {
            response.user.role = userWithRole.role;
            console.log('🟢 [LOGIN] Rôle récupéré:', response.user.role);
            return response;
          })
        );
      }),
      tap(response => this.handleAuthentication(response)),
      catchError((error) => {
        console.error('🔴 [LOGIN] Erreur:', error);
        return this.handleError(error);
      })
    );
  }

  /**
   * Mot de passe oublié - Version simulation
   */
  forgotPassword(email: string): Observable<any> {
    console.log('🔵 [SIMULATION] Demande de réinitialisation pour:', email);
    
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
    
    return new Observable(observer => {
      observer.next({ 
        ok: true, 
        message: 'Code envoyé avec succès',
        code: fakeCode 
      });
      observer.complete();
    });
  }

  /**
   * Réinitialiser le mot de passe - Version simulation
   */
  resetPassword(code: string, password: string, passwordConfirmation: string): Observable<any> {
    console.log('🔵 [SIMULATION] Réinitialisation avec code:', code);
    
    if (password !== passwordConfirmation) {
      return throwError(() => new Error('Les mots de passe ne correspondent pas'));
    }
    
    if (!code || code.length < 6) {
      return throwError(() => new Error('Code invalide'));
    }
    
    console.log('✅ [SIMULATION] Mot de passe réinitialisé avec succès');
    
    return new Observable(observer => {
      observer.next({ 
        ok: true, 
        message: 'Mot de passe réinitialisé avec succès' 
      });
      observer.complete();
    });
  }

  /**
   * Déconnexion
   */
  logout(): void {
    localStorage.removeItem('token');
    localStorage.removeItem('authData');
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
   * Récupérer le token JWT - CORRIGÉ
   */
  getToken(): string | null {
    // Essayer de récupérer depuis 'token' d'abord
    let token = localStorage.getItem('token');
    
    // Si pas trouvé, essayer depuis 'authData'
    if (!token) {
      const stored = localStorage.getItem('authData');
      if (stored) {
        try {
          const authData = JSON.parse(stored);
          token = authData.jwt;
          // Synchroniser pour les futures requêtes
          if (token) {
            localStorage.setItem('token', token);
          }
        } catch (e) {
          console.error('Erreur parsing authData:', e);
        }
      }
    }
    
    return token;
  }

  /**
   * Récupérer le rôle de l'utilisateur
   */
  getUserRole(): string | null {
    const user = this.currentUserSubject.value;
    if (user && user.role) {
      return user.role.name.toUpperCase();
    }
    return null;
  }

  /**
   * Récupérer l'utilisateur courant
   */
  getCurrentUser(): User | null {
    return this.currentUserSubject.value;
  }

  /**
   * Traitement après authentification - CORRIGÉ
   */
  private handleAuthentication(response: LoginResponse): void {
    console.log('🔵 [AUTH] handleAuthentication - User:', response.user);
    
    if (!response.user.confirmed) {
      throw new Error('Veuillez confirmer votre email');
    }
    
    if (response.user.blocked) {
      throw new Error('Votre compte est bloqué');
    }

    // STOCKER LE TOKEN (déjà fait plus tôt, mais on s'assure)
    localStorage.setItem('token', response.jwt);
    
    // Stocker aussi dans authData pour compatibilité
    localStorage.setItem('authData', JSON.stringify({
      jwt: response.jwt,
      user: response.user
    }));
    
    // Vérification immédiate
    const verifyToken = localStorage.getItem('token');
    console.log('🔍 Vérification stockage token:', verifyToken ? '✅ OK' : '❌ ÉCHEC');
    
    this.currentUserSubject.next(response.user);
    
    const roleName = response.user.role?.name?.toLowerCase() || 'employee';
    console.log('🔵 [AUTH] Redirection pour le rôle:', roleName);
    this.redirectByRole(roleName);
  }

  /**
   * Redirection selon le rôle
   */
  private redirectByRole(roleName: string): void {
    console.log('🔴 [AUTH] Redirection vers:', roleName);
    
    switch (roleName.toLowerCase()) {
      case 'admin':
        this.router.navigate(['/admin/dashboard']);
        break;
      case 'manager':
        this.router.navigate(['/manager/dashboard']);
        break;
      case 'employee':
        this.router.navigate(['/employee/dashboard']);
        break;
      default:
        this.router.navigate(['/dashboard']);
    }
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
        // S'assurer que le token est aussi dans 'token'
        if (authData.jwt) {
          localStorage.setItem('token', authData.jwt);
        }
      } catch (e) {
        console.error('Erreur lors du chargement de l\'utilisateur:', e);
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
   * Gestion centralisée des erreurs HTTP
   */
  private handleError(error: any): Observable<never> {
    console.log('🔴 [ERROR] Status:', error.status);
    console.log('🔴 [ERROR] Message:', error.message);
    
    let errorMessage = 'Email ou mot de passe incorrect';
    
    if (error.error) {
      if (error.error.error?.message) {
        errorMessage = error.error.error.message;
      } else if (error.error.message) {
        errorMessage = error.error.message;
      }
    }
    
    switch (error.status) {
      case 400:
        errorMessage = 'Email ou mot de passe incorrect';
        break;
      case 401:
        errorMessage = 'Non autorisé. Veuillez vous reconnecter.';
        break;
      case 403:
        errorMessage = 'Accès refusé. Votre compte est peut-être bloqué.';
        break;
      case 404:
        errorMessage = 'Email non trouvé';
        break;
      case 405:
        errorMessage = 'Erreur de configuration serveur';
        break;
      case 500:
        errorMessage = 'Erreur serveur. Veuillez réessayer plus tard.';
        break;
      default:
        if (!errorMessage || errorMessage === 'Email ou mot de passe incorrect') {
          errorMessage = 'Erreur de connexion. Vérifiez vos identifiants.';
        }
    }
    
    return throwError(() => new Error(errorMessage));
  }
}