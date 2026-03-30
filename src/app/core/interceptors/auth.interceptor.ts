// src/app/core/interceptors/auth.interceptor.ts
import { Injectable } from '@angular/core';
import { HttpInterceptor, HttpRequest, HttpHandler, HttpEvent, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { Router } from '@angular/router';

@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  constructor(private router: Router) {}

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    // Récupérer le token
    let token = localStorage.getItem('token');
    
    // Backup: chercher dans jwt
    if (!token) {
      token = localStorage.getItem('jwt');
    }
    
    // Backup: chercher dans authData
    if (!token) {
      const authDataStr = localStorage.getItem('authData');
      if (authDataStr) {
        try {
          const authData = JSON.parse(authDataStr);
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
    
    // Si token trouvé, l'ajouter aux headers
    if (token) {
      console.log('🔑 [Interceptor] Token trouvé, ajout au header pour:', req.url);
      const clonedRequest = req.clone({
        headers: req.headers.set('Authorization', `Bearer ${token}`)
      });
      
      return next.handle(clonedRequest).pipe(
        catchError((error: HttpErrorResponse) => {
          if (error.status === 401) {
            console.error('❌ [Interceptor] 401 Non autorisé, redirection login');
            localStorage.removeItem('token');
            localStorage.removeItem('jwt');
            localStorage.removeItem('authData');
            this.router.navigate(['/login']);
          }
          return throwError(() => error);
        })
      );
    } else {
      console.warn('⚠️ [Interceptor] Aucun token trouvé pour:', req.url);
      return next.handle(req);
    }
  }
}