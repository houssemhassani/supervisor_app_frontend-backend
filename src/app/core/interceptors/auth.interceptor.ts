// src/app/core/interceptors/auth.interceptor.ts
import { Injectable } from '@angular/core';
import { HttpInterceptor, HttpRequest, HttpHandler, HttpEvent, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { Router } from '@angular/router';

@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  constructor(private router: Router) {
    console.log('🔧 [AuthInterceptor] Interceptor créé');
  }

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    console.log('🚀 [AuthInterceptor] Interception de la requête:', req.url);
    
    // Récupérer le token
    let token = localStorage.getItem('token');
    
    console.log('🔑 [AuthInterceptor] Token trouvé:', token ? 'OUI' : 'NON');
    
    if (token) {
      console.log('🔑 [AuthInterceptor] Ajout du token au header');
      const clonedRequest = req.clone({
        headers: req.headers.set('Authorization', `Bearer ${token}`)
      });
      
      console.log('🔑 [AuthInterceptor] Header Authorization:', clonedRequest.headers.get('Authorization'));
      
      return next.handle(clonedRequest).pipe(
        catchError((error: HttpErrorResponse) => {
          if (error.status === 401) {
            console.error('❌ [AuthInterceptor] 401 Non autorisé');
            localStorage.removeItem('token');
            localStorage.removeItem('jwt');
            localStorage.removeItem('authData');
            this.router.navigate(['/login']);
          }
          return throwError(() => error);
        })
      );
    } else {
      console.warn('⚠️ [AuthInterceptor] Aucun token trouvé pour:', req.url);
      return next.handle(req);
    }
  }
}