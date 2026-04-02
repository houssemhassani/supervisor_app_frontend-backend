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
   * Connexion utilisateur - VERSION CORRIGÉE
   */
  // Modifiez votre méthode login dans auth.ts
login(email: string, password: string): Observable<LoginResponse> {
    const cleanEmail = email.trim().toLowerCase();
    const cleanPassword = password.trim();
    
    return this.http.post<LoginResponse>(`${this.apiUrl}/auth/local`, {
      identifier: cleanEmail,
      password: cleanPassword
    }).pipe(
      tap((response: LoginResponse) => {
        // Stocker le token
        localStorage.setItem('token', response.jwt);
        localStorage.setItem('jwt', response.jwt);
        
        // DÉTERMINER LE RÔLE SIMPLEMENT
        let roleName = 'employee';
        
        // Méthode 1: Par email
        if (cleanEmail.includes('manager') || cleanEmail.includes('chef')) {
          roleName = 'manager';
        } else if (cleanEmail.includes('admin')) {
          roleName = 'admin';
        }
        
        // Méthode 2: Si vous avez le rôle dans la réponse
        if (response.user.role?.name) {
          roleName = response.user.role.name.toLowerCase();
        }
        
        console.log(`🎭 Rôle déterminé: ${roleName}`);
        
        // Stocker le rôle
        localStorage.setItem('userRole', roleName);
        
        // Stocker l'utilisateur avec le rôle
        const userWithRole = {
          ...response.user,
          role: { id: 0, name: roleName, type: roleName }
        };
        
        localStorage.setItem('authData', JSON.stringify({
          jwt: response.jwt,
          user: userWithRole
        }));
        
        localStorage.setItem('user', JSON.stringify({
          id: response.user.id,
          email: response.user.email,
          username: response.user.username,
          role: roleName
        }));
        
        // Mettre à jour le BehaviorSubject
        this.currentUserSubject.next(userWithRole);
        
        // Rediriger
        console.log(`🔄 Redirection vers: /${roleName}/dashboard`);
        setTimeout(() => {
          this.router.navigate([`/${roleName}/dashboard`]);
        }, 100);
      }),
      map(response => response),
      catchError((error) => this.handleError(error))
    );
  }
  
  getUserRole(): string | null {
    // Priorité au localStorage direct
    const role = localStorage.getItem('userRole');
    if (role) {
      console.log('🎭 [getUserRole] Depuis localStorage:', role);
      return role;
    }
    
    // Sinon depuis currentUser
    const user = this.currentUserSubject.value;
    if (user?.role?.name) {
      const roleName = user.role.name.toLowerCase();
      console.log('🎭 [getUserRole] Depuis currentUser:', roleName);
      return roleName;
    }
    
    return 'employee';
  }


// Ajoutez cette nouvelle méthode
private getUserRoleWithFallback(jwt: string, user: User): Observable<{role: any}> {
  const headers = new HttpHeaders({
    'Authorization': `Bearer ${jwt}`
  });
  
  // Essayer plusieurs endpoints
  const endpoints = [
    `${this.apiUrl}/users/${user.id}?populate=role`,
    `${this.apiUrl}/users/${user.id}?populate=*`,
    `${this.apiUrl}/users/me?populate=role`,
    `${this.apiUrl}/users/me`
  ];
  
  return this.http.get(endpoints[0], { headers }).pipe(
    timeout(5000),
    map((data: any) => {
      console.log('🟢 [ROLE] Données reçues:', data);
      
      // Strapi v4
      if (data.role) {
        return { role: data.role };
      }
      // Strapi v5
      if (data.roles && data.roles.length > 0) {
        return { role: data.roles[0] };
      }
      // Si pas de rôle, essayer de récupérer depuis les données utilisateur originales
      if (user.role) {
        return { role: user.role };
      }
      return { role: null };
    }),
    catchError((error) => {
      console.warn('⚠️ [ROLE] Erreur récupération rôle, utilisation fallback:', error);
      
      // Fallback: déterminer le rôle via l'email
      let roleName = 'employee';
      if (user.email && user.email.toLowerCase().includes('manager')) {
        roleName = 'manager';
      } else if (user.email && user.email.toLowerCase().includes('admin')) {
        roleName = 'admin';
      }
      
      return of({ role: { id: 0, name: roleName, type: roleName } });
    })
  );
}

// Ajoutez cette méthode pour forcer la mise à jour
private updateCurrentUserWithRole(response: LoginResponse): void {
  console.log('🔄 [UPDATE] Mise à jour currentUser avec rôle');
  
  // S'assurer que le rôle est présent
  if (!response.user.role) {
    // Détection par email
    let roleName = 'employee';
    if (response.user.email && response.user.email.toLowerCase().includes('manager')) {
      roleName = 'manager';
    } else if (response.user.email && response.user.email.toLowerCase().includes('admin')) {
      roleName = 'admin';
    }
    response.user.role = { id: 0, name: roleName, type: roleName };
  }
  
  // Mettre à jour le BehaviorSubject
  this.currentUserSubject.next(response.user);
  
  // Stocker dans localStorage avec le rôle correct
  localStorage.setItem('userRole', response.user.role.name.toLowerCase());
  localStorage.setItem('user', JSON.stringify({
    id: response.user.id,
    email: response.user.email,
    username: response.user.username,
    role: response.user.role.name.toLowerCase()
  }));
  
  console.log('✅ [UPDATE] CurrentUser mis à jour:', this.currentUserSubject.value);
  console.log('✅ [UPDATE] Rôle stocké:', localStorage.getItem('userRole'));
}

// Ajoutez cette méthode dans AuthService
forceRoleUpdate(role: 'admin' | 'manager' | 'employee'): void {
  console.log(`🔧 [FORCE] Mise à jour forcée du rôle vers: ${role}`);
  
  const currentUser = this.currentUserSubject.value;
  if (currentUser) {
    currentUser.role = { id: 0, name: role, type: role };
    this.currentUserSubject.next(currentUser);
    
    localStorage.setItem('userRole', role);
    
    const userStr = localStorage.getItem('user');
    if (userStr) {
      try {
        const user = JSON.parse(userStr);
        user.role = role;
        localStorage.setItem('user', JSON.stringify(user));
      } catch(e) {}
    }
    
    const authDataStr = localStorage.getItem('authData');
    if (authDataStr) {
      try {
        const authData = JSON.parse(authDataStr);
        if (authData.user) {
          authData.user.role = { id: 0, name: role, type: role };
          localStorage.setItem('authData', JSON.stringify(authData));
        }
      } catch(e) {}
    }
  }
  
  console.log('✅ [FORCE] Rôle mis à jour, redirection...');
  this.redirectByRole(role);
}
  /**
   * Récupérer l'utilisateur avec son rôle - Version robuste
   */
  private getUserWithRole(jwt: string, user: User): Observable<any> {
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${jwt}`
    });
    
    console.log('🔵 [GET_USER] Récupération du rôle pour user ID:', user.id);
    
    // Essayer différentes URLs possibles selon la version de Strapi
    const urls = [
      `${this.apiUrl}/users/${user.id}?populate=role`,
      `${this.apiUrl}/users/${user.id}?populate=*`,
      `${this.apiUrl}/users/${user.id}`,
      `${this.apiUrl}/users/me?populate=role`
    ];
    
    // Essayer la première URL
    return this.http.get(urls[0], { headers }).pipe(
      timeout(5000),
      tap((data: any) => console.log('🟢 [GET_USER] Données reçues:', data)),
      map((data: any) => {
        // Strapi v4 structure
        if (data.role) {
          return data;
        }
        // Strapi v5 structure
        if (data.roles && data.roles.length > 0) {
          return { ...data, role: data.roles[0] };
        }
        return data;
      })
    );
  }

  /**
   * Détecter le rôle à partir de l'email
   */
  private detectRoleFromEmail(email: string): string | null {
    if (!email) return null;
    
    const emailLower = email.toLowerCase();
    
    // Vérifier les patterns d'email
    if (emailLower.includes('admin')) {
      return 'admin';
    }
    if (emailLower.includes('manager') || emailLower.includes('chef') || emailLower.includes('directeur')) {
      return 'manager';
    }
    if (emailLower.includes('employee') || emailLower.includes('staff') || emailLower.includes('user')) {
      return 'employee';
    }
    
    // Récupérer depuis localStorage si disponible
    const savedRole = localStorage.getItem('userRole');
    if (savedRole) {
      return savedRole;
    }
    
    return null;
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
   * Traitement après authentification - CORRIGÉ
   */
  private handleAuthentication(response: LoginResponse): void {
    console.log('🔵 [AUTH] handleAuthentication - Début');
    console.log('🔵 [AUTH] User reçu:', response.user);
    console.log('🔵 [AUTH] Role dans user:', response.user.role);
    
    if (!response.user.confirmed) {
      throw new Error('Veuillez confirmer votre email');
    }
    
    if (response.user.blocked) {
      throw new Error('Votre compte est bloqué');
    }

    // Stocker le token
    localStorage.setItem('token', response.jwt);
    localStorage.setItem('jwt', response.jwt);
    
    // Stocker authData
    localStorage.setItem('authData', JSON.stringify({
      jwt: response.jwt,
      user: response.user
    }));
    
    // Extraire et stocker le rôle
    let roleName = 'employee';
    if (response.user.role) {
      roleName = (response.user.role.name || response.user.role.type || 'employee').toLowerCase();
    } else {
      // Fallback: détecter via email
      const detectedRole = this.detectRoleFromEmail(response.user.email);
      if (detectedRole) {
        roleName = detectedRole;
      }
    }
    
    localStorage.setItem('userRole', roleName);
    
    // Stocker aussi un user simplifié
    localStorage.setItem('user', JSON.stringify({
      id: response.user.id,
      email: response.user.email,
      username: response.user.username,
      role: roleName
    }));
    
    console.log('✅ [AUTH] Rôle stocké:', roleName);
    console.log('✅ [AUTH] Vérification token:', !!localStorage.getItem('token'));
    console.log('✅ [AUTH] Vérification userRole:', localStorage.getItem('userRole'));
    
    this.currentUserSubject.next(response.user);
    
    // Rediriger
    console.log('🔵 [AUTH] Redirection pour le rôle:', roleName);
    this.redirectByRole(roleName);
  }

  /**
   * Redirection selon le rôle - CORRIGÉ
   */
  private redirectByRole(roleName: string): void {
    const role = roleName.toLowerCase();
    let redirectUrl = '/employee/dashboard';
    
    console.log('🔄 [REDIRECT] Rôle reçu:', role);
    
    switch (role) {
      case 'admin':
        redirectUrl = '/admin/dashboard';
        break;
      case 'manager':
        redirectUrl = '/manager/dashboard';
        break;
      case 'employee':
        redirectUrl = '/employee/dashboard';
        break;
      default:
        redirectUrl = '/dashboard';
    }
    
    console.log(`🔄 [REDIRECT] Redirection vers: ${redirectUrl}`);
    
    // Utiliser setTimeout pour éviter les problèmes de détection de changement
    setTimeout(() => {
      this.router.navigate([redirectUrl]).then(success => {
        if (success) {
          console.log('✅ [REDIRECT] Navigation réussie vers', redirectUrl);
        } else {
          console.error('❌ [REDIRECT] Échec de navigation vers', redirectUrl);
          // Fallback: utiliser window.location
          window.location.href = redirectUrl;
        }
      });
    }, 100);
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