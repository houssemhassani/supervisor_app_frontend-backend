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
    private authService: AuthService
  ) {
    console.log('🔧 [EmployeeApiService] Service créé');
  }

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
  
  getUserTasks(): Observable<any> {
    const url = `${this.apiUrl}/tasks/user`;
    console.log('📡 [API] GET', url);
    const headers = this.getHeaders();
    return this.http.get(url, { headers });
  }

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

  updateLeaveRequest(id: number, data: any): Observable<any> {
    const token = localStorage.getItem('token') || localStorage.getItem('jwt');
    
    if (!token) {
      return throwError(() => new Error('Non connecté'));
    }
    
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    });

    const payload = {
      data: {
        type: data.type,
        start_date: data.start_date,
        end_date: data.end_date,
        reason: data.reason
      }
    };
    
    return this.http.put(`${this.apiUrl}/leave-requests/${id}`, payload, { headers }).pipe(
      tap(response => console.log('✅ Demande modifiée:', response)),
      catchError(error => {
        console.error('❌ Erreur modification:', error);
        return throwError(() => error);
      })
    );
  }

  // ========== LEAVE REQUESTS ==========
  
  getLeaveRequests(userId?: number): Observable<any> {
    let url = `${this.apiUrl}/leave-requests?sort=createdAt:desc`;
    const headers = this.getHeaders();
    return this.http.get(url, { headers });
  }

  createLeaveRequest(data: any): Observable<any> {
    const token = localStorage.getItem('token') || localStorage.getItem('jwt');
    
    if (!token) {
      console.error('❌ Aucun token trouvé');
      return throwError(() => new Error('Non connecté'));
    }
    
    let userId = null;
    
    const userStr = localStorage.getItem('user');
    if (userStr) {
      try {
        const user = JSON.parse(userStr);
        userId = user.id;
        console.log('👤 User ID du localStorage:', userId);
      } catch(e) {
        console.error('Erreur parsing user:', e);
      }
    }
    
    if (!userId && token) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        userId = payload.id;
        console.log('👤 User ID du token:', userId);
      } catch(e) {
        console.error('Erreur décodage token:', e);
      }
    }
    
    if (!userId) {
      console.error('❌ Impossible de récupérer l\'ID utilisateur');
      return throwError(() => new Error('Utilisateur non connecté'));
    }
    
    console.log('🔑 Envoi avec userId:', userId);
    
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    });

    const payload = {
      data: {
        type: data.type,
        start_date: data.start_date,
        end_date: data.end_date,
        reason: data.reason,
        userId: userId
      }
    };

    console.log('📡 Payload envoyé:', JSON.stringify(payload, null, 2));
    
    return this.http.post(`${this.apiUrl}/leave-requests`, payload, { headers }).pipe(
      tap(response => console.log('✅ Succès:', response)),
      catchError(error => {
        console.error('❌ Erreur:', error);
        return throwError(() => error);
      })
    );
  }

  cancelLeaveRequest(id: number): Observable<any> {
    console.log(`📡 [API] DELETE /leave-requests/${id}`);
    const headers = this.getHeaders();
    return this.http.delete(`${this.apiUrl}/leave-requests/${id}`, { headers });
  }

  deleteLeaveRequest(id: number): Observable<any> {
    const token = localStorage.getItem('token') || localStorage.getItem('jwt');
    
    if (!token) {
      return throwError(() => new Error('Non connecté'));
    }
    
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    });
    
    console.log(`🗑️ Suppression demande ID: ${id}`);
    
    return this.http.delete(`${this.apiUrl}/leave-requests/${id}`, { headers }).pipe(
      tap(response => {
        console.log('✅ Demande supprimée avec succès');
        console.log('📦 Réponse brute:', response);
      }),
      catchError(error => {
        console.error('❌ Erreur suppression:', error);
        return throwError(() => error);
      })
    );
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

  // ========== ACTIVITY TRACKING ==========

  /**
   * Envoyer un log d'activité (clics souris + clavier)
   */
  sendActivityLog(data: {
    keyboard_clicks: number;
    mouse_clicks: number;
    activity_level: number;
    projectId?: number;
  }): Observable<any> {
    const token = localStorage.getItem('token') || localStorage.getItem('jwt');
    
    if (!token) {
      return throwError(() => new Error('Non connecté'));
    }
    
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    });

    let userId = null;
    const userStr = localStorage.getItem('user');
    if (userStr) {
      try {
        const user = JSON.parse(userStr);
        userId = user.id;
      } catch(e) {}
    }

    const payload = {
      data: {
        user: userId,
        keyboard_clicks: data.keyboard_clicks,
        mouse_clicks: data.mouse_clicks,
        activity_level: data.activity_level,
        recorded_at: new Date().toISOString(),
        ...(data.projectId && { project: data.projectId })
      }
    };

    console.log('📡 [API] POST /activity-logs');
    return this.http.post(`${this.apiUrl}/activity-logs`, payload, { headers }).pipe(
      tap(response => console.log('✅ Log activité envoyé')),
      catchError(error => {
        console.error('❌ Erreur:', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Récupérer les logs d'activité d'aujourd'hui
   */
  getTodayActivityLogs(): Observable<any> {
    const token = localStorage.getItem('token') || localStorage.getItem('jwt');
    
    if (!token) {
      return throwError(() => new Error('Non connecté'));
    }
    
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    });

    const today = new Date().toISOString().split('T')[0];
    const url = `${this.apiUrl}/activity-logs?filters[recorded_at][$gte]=${today}T00:00:00.000Z&sort=recorded_at:asc`;
    
    return this.http.get(url, { headers });
  }

  /**
   * Récupérer les statistiques d'activité du jour
   */
  getTodayActivityStats(): Observable<any> {
    const token = localStorage.getItem('token') || localStorage.getItem('jwt');
    
    if (!token) {
      return throwError(() => new Error('Non connecté'));
    }
    
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    });

    return this.http.get(`${this.apiUrl}/activity-logs/today-stats`, { headers });
  }

  // ========== SCREENSHOTS ==========

  /**
   * Capturer et comparer une capture d'écran
   */
  captureAndCompare(imageData: string, projectId: number | null): Observable<any> {
    console.log('🖼️ [SCREENSHOT] Début de captureAndCompare');
    console.log('🖼️ [SCREENSHOT] Taille des données image:', imageData?.length || 0, 'caractères');
    console.log('🖼️ [SCREENSHOT] ProjectId:', projectId);
    
    // Récupérer le token de plusieurs façons
    let token = localStorage.getItem('token');
    if (!token) token = localStorage.getItem('jwt');
    if (!token) {
      const authData = localStorage.getItem('authData');
      if (authData) {
        try {
          const parsed = JSON.parse(authData);
          token = parsed.jwt;
          console.log('🖼️ [SCREENSHOT] Token récupéré depuis authData');
        } catch(e) {
          console.error('🖼️ [SCREENSHOT] Erreur parsing authData:', e);
        }
      }
    }
    
    console.log('🖼️ [SCREENSHOT] Token présent:', token ? 'OUI' : 'NON');
    if (token) {
      console.log('🖼️ [SCREENSHOT] Début du token:', token.substring(0, 30) + '...');
      console.log('🖼️ [SCREENSHOT] Longueur du token:', token.length);
    }
    
    if (!token) {
      console.error('🖼️ [SCREENSHOT] ❌ Aucun token trouvé !');
      return throwError(() => new Error('Non connecté - Veuillez vous reconnecter'));
    }
    
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    });

    const payload = {
      imageData: imageData,
      projectId: projectId
    };

    console.log('🖼️ [SCREENSHOT] Envoi de la requête à:', `${this.apiUrl}/screenshots/capture-and-compare`);
    console.log('🖼️ [SCREENSHOT] Headers:', { Authorization: 'Bearer ' + token.substring(0, 20) + '...' });
    
    return this.http.post(`${this.apiUrl}/screenshots/capture-and-compare`, payload, { headers }).pipe(
      tap(response => {
        console.log('🖼️ [SCREENSHOT] ✅ Réponse reçue avec succès!');
        console.log('🖼️ [SCREENSHOT] Réponse:', response);
      }),
      catchError(error => {
        console.error('🖼️ [SCREENSHOT] ❌ Erreur détaillée:');
        console.error('🖼️ [SCREENSHOT] Status:', error.status);
        console.error('🖼️ [SCREENSHOT] StatusText:', error.statusText);
        console.error('🖼️ [SCREENSHOT] Message:', error.message);
        console.error('🖼️ [SCREENSHOT] Error:', error.error);
        
        if (error.status === 401) {
          console.error('🖼️ [SCREENSHOT] 🔴 Token invalide ou expiré!');
          console.error('🖼️ [SCREENSHOT] Token utilisé:', token.substring(0, 30) + '...');
        }
        if (error.status === 403) {
          console.error('🖼️ [SCREENSHOT] 🔴 Permission refusée!');
          console.error('🖼️ [SCREENSHOT] Vérifiez les permissions dans Strapi Admin');
        }
        if (error.status === 404) {
          console.error('🖼️ [SCREENSHOT] 🔴 Route non trouvée!');
          console.error('🖼️ [SCREENSHOT] URL:', `${this.apiUrl}/screenshots/capture-and-compare`);
        }
        
        return throwError(() => error);
      })
    );
  }

  /**
   * Récupérer les captures d'écran du jour
   */
  getTodayScreenshots(): Observable<any> {
    console.log('🖼️ [SCREENSHOT] Début de getTodayScreenshots');
    
    const token = localStorage.getItem('token') || localStorage.getItem('jwt');
    
    if (!token) {
      console.error('🖼️ [SCREENSHOT] ❌ Aucun token trouvé');
      return throwError(() => new Error('Non connecté'));
    }
    
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    });

    console.log('🖼️ [SCREENSHOT] Envoi requête GET /screenshots/today');
    
    return this.http.get(`${this.apiUrl}/screenshots/today`, { headers }).pipe(
      tap(response => {
        console.log('🖼️ [SCREENSHOT] ✅ Captures récupérées:', response);
      }),
      catchError(error => {
        console.error('🖼️ [SCREENSHOT] ❌ Erreur récupération captures:', error);
        return throwError(() => error);
      })
    );
  }
  exportForAI(startDate: string, endDate: string): Observable<any> {
  const token = localStorage.getItem('token') || localStorage.getItem('jwt');
  
  if (!token) {
    return throwError(() => new Error('Non connecté'));
  }
  
  const headers = new HttpHeaders({
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  });

  return this.http.get(`${this.apiUrl}/screenshots/ai/export-data?startDate=${startDate}&endDate=${endDate}`, { headers });
}
}