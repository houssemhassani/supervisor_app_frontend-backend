// src/app/services/employee.ts
import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, tap, catchError, throwError } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthService } from '../core/services/AuthService/auth';
import { HttpParams } from '@angular/common/http';

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

 // Dans getHeaders() de employee.ts
private getHeaders(): HttpHeaders {
  const token = localStorage.getItem('token') || localStorage.getItem('jwt');
  
  console.log('🔑 Token trouvé:', token ? 'OUI' : 'NON');
  if (token) {
    console.log('🔑 Début du token:', token.substring(0, 30) + '...');
  }
  
  if (!token) {
    console.warn('⚠️ Aucun token trouvé dans le localStorage');
    return new HttpHeaders({
      'Content-Type': 'application/json'
    });
  }
  
  return new HttpHeaders({
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  });
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
  
  
// src/app/services/employee.ts
getUserTasks(): Observable<any> {
  const url = `${this.apiUrl}/tasks/user`;
  console.log('📡 [API] GET', url);
  const headers = this.getHeaders();
  return this.http.get(url, { headers });
}

// src/app/services/employee.ts
// src/app/services/employee.ts
// src/app/services/employee.ts
getTasks(userId?: number): Observable<any> {
  const url = `${this.apiUrl}/tasks?sort=due_date:asc`;
  console.log('📡 [API] GET', url, 'à', new Date().toLocaleTimeString());
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