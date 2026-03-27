// src/app/services/employee.ts
import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, tap, catchError, throwError } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthService } from '../core/services/AuthService/auth';

@Injectable({
  providedIn: 'root'
})
export class EmployeeApiService {
  private apiUrl = environment.apiUrl || 'http://localhost:1337/api';

  constructor(
    private http: HttpClient,
    private authService: AuthService  // ← Injecter AuthService
  ) {
    console.log('🔧 [EmployeeApiService] Service créé');
  }

  /**
   * Récupère les headers avec le token JWT
   */
  private getHeaders(): HttpHeaders {
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
    
    console.log('🔑 [getHeaders] Token trouvé:', token ? 'OUI' : 'NON');
    console.log('🔑 [getHeaders] Début du token:', token ? token.substring(0, 50) + '...' : 'NON');
    
    if (!token) {
      return new HttpHeaders({
        'Content-Type': 'application/json'
      });
    }
    
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    });
    
    console.log('🔑 [getHeaders] Header Authorization:', headers.get('Authorization')?.substring(0, 60) + '...');
    
    return headers;
  }

  isAuthenticated(): boolean {
    const token = localStorage.getItem('token');
    console.log('🔐 [isAuthenticated] Token présent:', !!token);
    return !!token;
  }

  // ========== DASHBOARD ==========
  
  getTodayDashboard(): Observable<any> {
    console.log('📡 [API] GET /dashboard/today');
    const headers = this.getHeaders();
    return this.http.get(`${this.apiUrl}/dashboard/today`, { headers }).pipe(
      tap(response => console.log('✅ [API] Réponse reçue:', response)),
      catchError(error => {
        console.error('❌ [API] Erreur:', error.status, error.message);
        if (error.status === 401) {
          console.error('❌ Token invalide ou expiré');
        }
        return throwError(() => error);
      })
    );
  }

  getWeeklyStats(): Observable<any> {
    console.log('📡 [API] GET /dashboard/weekly-stats');
    const headers = this.getHeaders();
    return this.http.get(`${this.apiUrl}/dashboard/weekly-stats`, { headers });
  }

  // ========== ATTENDANCE ==========
  
  checkIn(data?: any): Observable<any> {
    console.log('📡 [API] POST /dashboard/check-in');
    const headers = this.getHeaders();
    return this.http.post(`${this.apiUrl}/dashboard/check-in`, data || {}, { headers });
  }

  checkOut(): Observable<any> {
    console.log('📡 [API] PUT /dashboard/check-out');
    const headers = this.getHeaders();
    return this.http.put(`${this.apiUrl}/dashboard/check-out`, {}, { headers });
  }

  startBreak(data?: any): Observable<any> {
    console.log('📡 [API] POST /dashboard/break/start');
    const headers = this.getHeaders();
    return this.http.post(`${this.apiUrl}/dashboard/break/start`, data || {}, { headers });
  }

  endBreak(): Observable<any> {
    console.log('📡 [API] PUT /dashboard/break/end');
    const headers = this.getHeaders();
    return this.http.put(`${this.apiUrl}/dashboard/break/end`, {}, { headers });
  }

  // ========== TASKS ==========
  
  getTasks(userId?: number): Observable<any> {
    let url = `${this.apiUrl}/tasks?populate=*&sort=due_date:asc`;
    if (userId) {
      url += `&filters[assigned_to][id][$eq]=${userId}`;
    }
    console.log('📡 [API] GET', url);
    const headers = this.getHeaders();
    return this.http.get(url, { headers });
  }

  updateTaskStatus(taskId: number, status: string): Observable<any> {
    console.log(`📡 [API] PUT /tasks/${taskId}`);
    const headers = this.getHeaders();
    return this.http.put(`${this.apiUrl}/tasks/${taskId}`, { 
      data: { statuts: status } 
    }, { headers });
  }

  // ========== LEAVE REQUESTS ==========
  
  getLeaveRequests(userId?: number): Observable<any> {
    let url = `${this.apiUrl}/leave-requests?populate=*&sort=createdAt:desc`;
    if (userId) {
      url += `&filters[user][id][$eq]=${userId}`;
    }
    console.log('📡 [API] GET', url);
    const headers = this.getHeaders();
    return this.http.get(url, { headers });
  }

  createLeaveRequest(data: any): Observable<any> {
    console.log('📡 [API] POST /leave-requests');
    const headers = this.getHeaders();
    return this.http.post(`${this.apiUrl}/leave-requests`, { data }, { headers });
  }

  cancelLeaveRequest(id: number): Observable<any> {
    console.log(`📡 [API] DELETE /leave-requests/${id}`);
    const headers = this.getHeaders();
    return this.http.delete(`${this.apiUrl}/leave-requests/${id}`, { headers });
  }

  // ========== TEST AUTH ==========
  
  testAuth(): Observable<any> {
    console.log('🧪 [API] GET /dashboard/test-auth');
    const headers = this.getHeaders();
    return this.http.get(`${this.apiUrl}/dashboard/test-auth`, { headers }).pipe(
      tap(response => console.log('✅ Test auth réussi:', response)),
      catchError(error => {
        console.error('❌ Test auth échoué:', error);
        return throwError(() => error);
      })
    );
  }
}