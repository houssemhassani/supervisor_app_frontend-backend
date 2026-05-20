// src/app/services/employee.ts
/**
 * Service API pour les employés
 * Gère toutes les communications avec le backend Strapi
 * Version: 2.1.0 - Corrigée et optimisée
 */

import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Observable, throwError, of, forkJoin, BehaviorSubject, timer } from 'rxjs';
import { tap, catchError, retry, timeout, map, switchMap, shareReplay, delay } from 'rxjs/operators';
import { environment } from '../../environments/environment';

// ============================================
// INTERFACES ET TYPES
// ============================================

export interface User {
  id: number;
  username: string;
  email: string;
  firstName?: string;
  lastName?: string;
  position?: string;
}

export interface Attendance {
  id: number;
  date: string;
  check_in: string | null;
  check_out: string | null;
  statuts: 'PRESENT' | 'ABSENT' | 'LATE' | 'HALF_DAY' | 'HOLIDAY';
  work_hours: number;
  check_in_late_minutes: number;
  notes?: string;
}

export interface TodayDashboardResponse {
  success: boolean;
  data: {
    date: string;
    attendance: {
      id: number | null;
      checkIn: string | null;
      checkOut: string | null;
      status: string;
      isLate: boolean;
      lateMinutes: number;
      workHours: number;
      breakHours: number;
      expectedHours: number;
    };
    currentSession: {
      id: number;
      status: string;
      startTime: string;
      isOnBreak: boolean;
      breakInfo: {
        id: number;
        type: string;
        startTime: string;
        duration: number;
      } | null;
    } | null;
    actions: {
      canCheckIn: boolean;
      canCheckOut: boolean;
      canStartBreak: boolean;
      canEndBreak: boolean;
    };
  };
}

export interface ActivityLog {
  id: number;
  keyboard_clicks: number;
  mouse_clicks: number;
  activity_level: number;
  recorded_at: string;
}

export interface ActivityStats {
  total_keyboard_clicks: number;
  total_mouse_clicks: number;
  avg_activity_level: number;
  logs_count: number;
  logs: ActivityLog[];
}

export interface Screenshot {
  id: number;
  captured_at: string;
  is_identical: boolean;
  similarity_score: number;
  image?: {
    url: string;
  };
}

// ============================================
// SERVICE PRINCIPAL
// ============================================

@Injectable({
  providedIn: 'root'
})
export class EmployeeApiService {
  private apiUrl: string;
  private defaultTimeout = 30000; // 30 secondes
  private maxRetries = 2;
  
  // Cache pour les données fréquemment utilisées
  private todayDashboardCache: BehaviorSubject<TodayDashboardResponse | null> = new BehaviorSubject<TodayDashboardResponse | null>(null);
  private lastDashboardFetch = 0;
  private dashboardCacheTTL = 30000; // 30 secondes

  constructor(private http: HttpClient) {
    this.apiUrl = environment.apiUrl || 'http://localhost:1337/api';
    console.log('🔧 [EmployeeApiService] Service créé - API URL:', this.apiUrl);
  }

  // ============================================
  // MÉTHODES PRIVÉES
  // ============================================

  private getHeaders(): HttpHeaders {
    const token = this.getToken();
    
    let headers = new HttpHeaders({
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    });
    
    if (token) {
      headers = headers.set('Authorization', `Bearer ${token}`);
    }
    
    return headers;
  }

  private getToken(): string | null {
    // Essayer plusieurs sources possibles
    const token = localStorage.getItem('token') || 
                  localStorage.getItem('jwt') || 
                  this.getTokenFromAuthData();
    
    if (!token) {
      console.warn('⚠️ Aucun token trouvé dans le localStorage');
    }
    
    return token;
  }

  private getTokenFromAuthData(): string | null {
    const authData = localStorage.getItem('authData');
    if (authData) {
      try {
        const parsed = JSON.parse(authData);
        return parsed.jwt || parsed.token || null;
      } catch (e) {
        return null;
      }
    }
    return null;
  }

  private getUserId(): number | null {
    // Essayer depuis localStorage
    const userStr = localStorage.getItem('user');
    if (userStr) {
      try {
        const user = JSON.parse(userStr);
        return user.id || null;
      } catch (e) {}
    }
    
    // Essayer depuis le token JWT
    const token = this.getToken();
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        return payload.id || null;
      } catch (e) {}
    }
    
    return null;
  }

  private handleError(error: HttpErrorResponse, context: string): Observable<never> {
    let errorMessage = 'Une erreur est survenue';
    
    console.error(`❌ [EmployeeApiService] ${context}:`, error);
    
    if (error.error instanceof ErrorEvent) {
      // Erreur côté client
      errorMessage = `Erreur réseau: ${error.error.message}`;
    } else {
      // Erreur côté serveur
      switch (error.status) {
        case 0:
          errorMessage = 'Impossible de se connecter au serveur. Vérifiez que le backend est démarré.';
          break;
        case 400:
          errorMessage = error.error?.error?.message || 'Requête invalide';
          break;
        case 401:
          errorMessage = 'Session expirée. Veuillez vous reconnecter.';
          // Déclencher une déconnexion silencieuse si nécessaire
          this.handleUnauthorized();
          break;
        case 403:
          errorMessage = 'Vous n\'avez pas les droits nécessaires';
          break;
        case 404:
          errorMessage = 'Ressource non trouvée';
          break;
        case 409:
          errorMessage = 'Conflit avec les données existantes';
          break;
        case 429:
          errorMessage = 'Trop de requêtes. Veuillez réessayer dans quelques instants.';
          break;
        case 500:
          errorMessage = 'Erreur serveur. Veuillez réessayer plus tard.';
          break;
        default:
          errorMessage = error.error?.error?.message || error.message || `Erreur ${error.status}`;
      }
    }
    
    return throwError(() => new Error(errorMessage));
  }

  private handleUnauthorized(): void {
    // Ne pas déconnecter immédiatement pour éviter une boucle
    // Juste logger l'erreur
    console.warn('⚠️ Token invalide ou expiré - L\'utilisateur devra se reconnecter');
  }

  private isCacheValid(lastFetch: number, ttl: number): boolean {
    return Date.now() - lastFetch < ttl;
  }

  // ============================================
  // DASHBOARD
  // ============================================
  
  /**
   * Récupère le dashboard du jour (avec cache)
   * @param forceRefresh - Force le rafraîchissement du cache
   */
  getTodayDashboard(forceRefresh: boolean = false): Observable<TodayDashboardResponse> {
    console.log('📡 [API] GET /dashboard/today');
    
    // Vérifier le cache
    if (!forceRefresh && this.isCacheValid(this.lastDashboardFetch, this.dashboardCacheTTL)) {
      const cached = this.todayDashboardCache.value;
      if (cached) {
        console.log('💾 [Cache] Dashboard du jour récupéré depuis le cache');
        return of(cached);
      }
    }
    
    const headers = this.getHeaders();
    
    return this.http.get<TodayDashboardResponse>(`${this.apiUrl}/dashboard/today`, { headers }).pipe(
      timeout(this.defaultTimeout),
      retry(this.maxRetries),
      tap(response => {
        console.log('✅ [API] Dashboard récupéré');
        this.todayDashboardCache.next(response);
        this.lastDashboardFetch = Date.now();
      }),
      catchError(error => this.handleError(error, 'getTodayDashboard'))
    );
  }

  /**
   * Rafraîchit le dashboard (force le cache)
   */
  refreshDashboard(): Observable<TodayDashboardResponse> {
    return this.getTodayDashboard(true);
  }

  /**
   * Récupère les statistiques hebdomadaires
   */
  getWeeklyStats(): Observable<any> {
    console.log('📡 [API] GET /dashboard/weekly-stats');
    const headers = this.getHeaders();
    
    return this.http.get(`${this.apiUrl}/dashboard/weekly-stats`, { headers }).pipe(
      timeout(this.defaultTimeout),
      retry(1),
      catchError(error => this.handleError(error, 'getWeeklyStats'))
    );
  }

  // ============================================
  // ATTENDANCE (POINTAGE)
  // ============================================
  
  /**
   * Check-in (arrivée)
   */
  checkIn(data?: any): Observable<any> {
    console.log('📡 [API] POST /dashboard/check-in');
    const headers = this.getHeaders();
    
    return this.http.post(`${this.apiUrl}/dashboard/check-in`, data || {}, { headers }).pipe(
      timeout(this.defaultTimeout),
      tap(response => {
        console.log('✅ Check-in effectué');
        // Invalider le cache du dashboard
        this.invalidateDashboardCache();
      }),
      catchError(error => this.handleError(error, 'checkIn'))
    );
  }

  /**
   * Check-out (départ)
   */
  checkOut(): Observable<any> {
    console.log('📡 [API] PUT /dashboard/check-out');
    const headers = this.getHeaders();
    
    return this.http.put(`${this.apiUrl}/dashboard/check-out`, {}, { headers }).pipe(
      timeout(this.defaultTimeout),
      tap(response => {
        console.log('✅ Check-out effectué');
        this.invalidateDashboardCache();
      }),
      catchError(error => this.handleError(error, 'checkOut'))
    );
  }

  /**
   * Démarrer une pause
   * @param type - Type de pause ('SHORT', 'LUNCH', 'BREAK')
   */
  startBreak(data?: any): Observable<any> {
    console.log('📡 [API] POST /dashboard/break/start');
    const headers = this.getHeaders();
    
    return this.http.post(`${this.apiUrl}/dashboard/break/start`, data || {}, { headers }).pipe(
      timeout(this.defaultTimeout),
      tap(response => {
        console.log('✅ Pause démarrée');
        this.invalidateDashboardCache();
      }),
      catchError(error => this.handleError(error, 'startBreak'))
    );
  }

  /**
   * Terminer la pause en cours
   */
  endBreak(): Observable<any> {
    console.log('📡 [API] PUT /dashboard/break/end');
    const headers = this.getHeaders();
    
    return this.http.put(`${this.apiUrl}/dashboard/break/end`, {}, { headers }).pipe(
      timeout(this.defaultTimeout),
      tap(response => {
        console.log('✅ Pause terminée');
        this.invalidateDashboardCache();
      }),
      catchError(error => this.handleError(error, 'endBreak'))
    );
  }

  /**
   * Vérifie si l'utilisateur peut démarrer une pause
   */
  canStartBreak(): Observable<boolean> {
    return this.getTodayDashboard().pipe(
      map(response => response.data.actions.canStartBreak),
      catchError(() => of(false))
    );
  }

  /**
   * Vérifie si l'utilisateur peut terminer sa pause
   */
  canEndBreak(): Observable<boolean> {
    return this.getTodayDashboard().pipe(
      map(response => response.data.actions.canEndBreak),
      catchError(() => of(false))
    );
  }

  // ============================================
  // TASKS (TÂCHES)
  // ============================================
  
  /**
   * Récupère les tâches de l'utilisateur connecté
   */
  getUserTasks(): Observable<any> {
    const url = `${this.apiUrl}/tasks/user`;
    console.log('📡 [API] GET', url);
    const headers = this.getHeaders();
    
    return this.http.get(url, { headers }).pipe(
      timeout(this.defaultTimeout),
      retry(1),
      catchError(error => this.handleError(error, 'getUserTasks'))
    );
  }

  /**
   * Récupère toutes les tâches (avec filtres optionnels)
   * @param userId - Filtrer par utilisateur
   */
  getTasks(userId?: number): Observable<any> {
    let url = `${this.apiUrl}/tasks?sort=due_date:asc`;
    if (userId) {
      url += `&filters[assigned_to][id][$eq]=${userId}`;
    }
    
    console.log('📡 [API] GET', url);
    const headers = this.getHeaders();
    
    return this.http.get(url, { headers }).pipe(
      timeout(this.defaultTimeout),
      catchError(error => this.handleError(error, 'getTasks'))
    );
  }

  /**
   * Met à jour le statut d'une tâche
   * @param taskId - ID de la tâche
   * @param status - Nouveau statut ('TODO', 'IN_PROGRESS', 'DONE')
   */
  updateTaskStatus(taskId: number, status: string): Observable<any> {
    console.log(`📡 [API] PUT /tasks/${taskId} - Nouveau statut: ${status}`);
    const headers = this.getHeaders();
    
    return this.http.put(`${this.apiUrl}/tasks/${taskId}`, { 
      data: { statuts: status } 
    }, { headers }).pipe(
      timeout(this.defaultTimeout),
      tap(() => console.log(`✅ Statut de la tâche ${taskId} mis à jour: ${status}`)),
      catchError(error => this.handleError(error, 'updateTaskStatus'))
    );
  }

  /**
   * Récupère les statistiques des tâches de l'utilisateur
   */
  getTaskStats(): Observable<{ total: number; completed: number; inProgress: number; todo: number; completionRate: number }> {
    return this.getUserTasks().pipe(
      map((response: any) => {
        const tasks = response.data || [];
        const total = tasks.length;
        const completed = tasks.filter((t: any) => t.statuts === 'DONE').length;
        const inProgress = tasks.filter((t: any) => t.statuts === 'IN_PROGRESS').length;
        const todo = tasks.filter((t: any) => t.statuts === 'TODO').length;
        
        return {
          total,
          completed,
          inProgress,
          todo,
          completionRate: total > 0 ? Math.round((completed / total) * 100) : 0
        };
      }),
      catchError(() => of({ total: 0, completed: 0, inProgress: 0, todo: 0, completionRate: 0 }))
    );
  }

  // ============================================
  // LEAVE REQUESTS (CONGÉS)
  // ============================================
  
  /**
   * Récupère les demandes de congé
   * @param userId - Filtrer par utilisateur (optionnel)
   */
  getLeaveRequests(userId?: number): Observable<any> {
    let url = `${this.apiUrl}/leave-requests?sort=createdAt:desc&populate=user`;
    
    if (userId) {
      url += `&filters[user][id][$eq]=${userId}`;
    }
    
    console.log('📡 [API] GET', url);
    const headers = this.getHeaders();
    
    return this.http.get(url, { headers }).pipe(
      timeout(this.defaultTimeout),
      retry(1),
      catchError(error => this.handleError(error, 'getLeaveRequests'))
    );
  }

  /**
   * Récupère les demandes de congé de l'utilisateur connecté
   */
  getMyLeaveRequests(): Observable<any> {
    const userId = this.getUserId();
    if (!userId) {
      return throwError(() => new Error('Utilisateur non connecté'));
    }
    return this.getLeaveRequests(userId);
  }

  /**
   * Crée une demande de congé
   */
  createLeaveRequest(data: {
    type: string;
    start_date: string;
    end_date: string;
    reason: string;
  }): Observable<any> {
    const token = this.getToken();
    
    if (!token) {
      console.error('❌ Aucun token trouvé');
      return throwError(() => new Error('Non connecté'));
    }
    
    const userId = this.getUserId();
    
    if (!userId) {
      console.error('❌ Impossible de récupérer l\'ID utilisateur');
      return throwError(() => new Error('Utilisateur non connecté'));
    }
    
    console.log('🔑 Envoi avec userId:', userId);
    
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    });

    // Validation des dates
    const startDate = new Date(data.start_date);
    const endDate = new Date(data.end_date);
    
    if (startDate > endDate) {
      return throwError(() => new Error('La date de début doit être antérieure à la date de fin'));
    }
    
    if (startDate < new Date()) {
      return throwError(() => new Error('La date de début ne peut pas être dans le passé'));
    }

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
      timeout(this.defaultTimeout),
      tap(response => console.log('✅ Demande de congé créée avec succès')),
      catchError(error => this.handleError(error, 'createLeaveRequest'))
    );
  }

  /**
   * Met à jour une demande de congé
   */
  updateLeaveRequest(id: number, data: {
    type?: string;
    start_date?: string;
    end_date?: string;
    reason?: string;
  }): Observable<any> {
    const token = this.getToken();
    
    if (!token) {
      return throwError(() => new Error('Non connecté'));
    }
    
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    });

    const payload = {
      data: {
        ...(data.type && { type: data.type }),
        ...(data.start_date && { start_date: data.start_date }),
        ...(data.end_date && { end_date: data.end_date }),
        ...(data.reason && { reason: data.reason })
      }
    };
    
    return this.http.put(`${this.apiUrl}/leave-requests/${id}`, payload, { headers }).pipe(
      timeout(this.defaultTimeout),
      tap(response => console.log(`✅ Demande ${id} modifiée`)),
      catchError(error => this.handleError(error, 'updateLeaveRequest'))
    );
  }

  /**
   * Supprime une demande de congé
   */
  deleteLeaveRequest(id: number): Observable<any> {
    const token = this.getToken();
    
    if (!token) {
      return throwError(() => new Error('Non connecté'));
    }
    
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    });
    
    console.log(`🗑️ Suppression demande ID: ${id}`);
    
    return this.http.delete(`${this.apiUrl}/leave-requests/${id}`, { headers }).pipe(
      timeout(this.defaultTimeout),
      tap(() => console.log(`✅ Demande ${id} supprimée`)),
      catchError(error => this.handleError(error, 'deleteLeaveRequest'))
    );
  }

  /**
   * Annule une demande de congé
   */
  cancelLeaveRequest(id: number): Observable<any> {
    console.log(`📡 [API] Annulation demande ${id}`);
    return this.updateLeaveRequest(id, {}).pipe(
      // Annuler signifie mettre le statut à CANCELLED
      tap(() => console.log(`✅ Demande ${id} annulée`))
    );
  }

  // ============================================
  // ACTIVITY TRACKING (SUIVI D'ACTIVITÉ)
  // ============================================

  /**
   * Envoie un log d'activité (clics souris + clavier)
   */
  sendActivityLog(data: {
    keyboard_clicks: number;
    mouse_clicks: number;
    activity_level: number;
    projectId?: number;
  }): Observable<any> {
    const token = this.getToken();
    
    if (!token) {
      return throwError(() => new Error('Non connecté'));
    }
    
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    });

    const userId = this.getUserId();

    const payload = {
      data: {
        user: userId,
        keyboard_clicks: data.keyboard_clicks,
        mouse_clicks: data.mouse_clicks,
        activity_level: Math.min(100, Math.max(0, data.activity_level)),
        recorded_at: new Date().toISOString(),
        ...(data.projectId && { project: data.projectId })
      }
    };

    console.log('📡 [API] POST /activity-logs');
    
    return this.http.post(`${this.apiUrl}/activity-logs`, payload, { headers }).pipe(
      timeout(10000), // 10 secondes pour les logs
      tap(() => console.log('✅ Log activité envoyé')),
      catchError(error => {
        console.warn('⚠️ Erreur envoi log activité (non critique):', error.message);
        // Ne pas échouer silencieusement pour ne pas bloquer l'utilisateur
        return of({ success: false, error: error.message });
      })
    );
  }

  /**
   * Récupère les logs d'activité d'aujourd'hui
   */
  getTodayActivityLogs(): Observable<any> {
    const token = this.getToken();
    
    if (!token) {
      return throwError(() => new Error('Non connecté'));
    }
    
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    });

    const today = new Date().toISOString().split('T')[0];
    const url = `${this.apiUrl}/activity-logs?filters[recorded_at][$gte]=${today}T00:00:00.000Z&sort=recorded_at:asc`;
    
    return this.http.get(url, { headers }).pipe(
      timeout(this.defaultTimeout),
      catchError(error => this.handleError(error, 'getTodayActivityLogs'))
    );
  }

  /**
   * Récupère les statistiques d'activité du jour
   */
  getTodayActivityStats(): Observable<ActivityStats> {
    const token = this.getToken();
    
    if (!token) {
      return throwError(() => new Error('Non connecté'));
    }
    
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    });

    return this.http.get<ActivityStats>(`${this.apiUrl}/activity-logs/today-stats`, { headers }).pipe(
      timeout(this.defaultTimeout),
      catchError(error => this.handleError(error, 'getTodayActivityStats'))
    );
  }

  // ============================================
  // SCREENSHOTS (CAPTURES D'ÉCRAN)
  // ============================================

  /**
   * Capture et compare une capture d'écran
   * @param imageData - Données de l'image en base64
   * @param projectId - ID du projet (optionnel)
   */
  captureAndCompare(imageData: string, projectId: number | null): Observable<any> {
    console.log('🖼️ [SCREENSHOT] Début de captureAndCompare');
    console.log('🖼️ Taille des données:', imageData?.length || 0, 'caractères');
    
    const token = this.getToken();
    
    if (!token) {
      console.error('🖼️ ❌ Aucun token trouvé');
      return throwError(() => new Error('Non connecté - Veuillez vous reconnecter'));
    }
    
    // Validation de l'image
    if (!imageData || imageData.length < 100) {
      console.error('🖼️ ❌ Données image invalides');
      return throwError(() => new Error('Données image invalides'));
    }
    
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    });

    const payload = {
      imageData: imageData,
      projectId: projectId
    };
    
    return this.http.post(`${this.apiUrl}/screenshots/capture-and-compare`, payload, { headers }).pipe(
      timeout(20000), // 20 secondes pour l'upload
      retry(1),
      tap(response => {
        console.log('🖼️ ✅ Capture envoyée avec succès');
        // Invalider le cache du dashboard car les métriques ont changé
        this.invalidateDashboardCache();
      }),
      catchError(error => {
        console.error('🖼️ ❌ Erreur capture:', error.status, error.message);
        
        if (error.status === 401) {
          console.error('🖼️ 🔴 Token invalide ou expiré');
        }
        if (error.status === 413) {
          console.error('🖼️ 🔴 Image trop volumineuse');
          return throwError(() => new Error('L\'image est trop volumineuse. Veuillez réduire sa taille.'));
        }
        
        return this.handleError(error, 'captureAndCompare');
      })
    );
  }

  /**
   * Récupère les captures d'écran du jour
   */
  getTodayScreenshots(): Observable<Screenshot[]> {
    console.log('🖼️ [API] GET /screenshots/today');
    
    const token = this.getToken();
    
    if (!token) {
      return throwError(() => new Error('Non connecté'));
    }
    
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    });

    return this.http.get<{ data: Screenshot[] }>(`${this.apiUrl}/screenshots/today`, { headers }).pipe(
      timeout(this.defaultTimeout),
      map(response => response.data || []),
      catchError(error => this.handleError(error, 'getTodayScreenshots'))
    );
  }

  /**
   * Exporte les données pour l'IA
   * @param startDate - Date de début (YYYY-MM-DD)
   * @param endDate - Date de fin (YYYY-MM-DD)
   */
  exportForAI(startDate: string, endDate: string): Observable<any> {
    const token = this.getToken();
    
    if (!token) {
      return throwError(() => new Error('Non connecté'));
    }
    
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    });

    const params = new HttpParams()
      .set('startDate', startDate)
      .set('endDate', endDate);

    return this.http.get(`${this.apiUrl}/screenshots/ai/export-data`, { headers, params }).pipe(
      timeout(this.defaultTimeout),
      catchError(error => this.handleError(error, 'exportForAI'))
    );
  }

  // ============================================
  // AUTHENTIFICATION
  // ============================================
  
  /**
   * Vérifie si l'utilisateur est authentifié
   */
  isAuthenticated(): boolean {
    const token = this.getToken();
    const isValid = !!token;
    console.log('🔐 [isAuthenticated] Token présent:', isValid);
    return isValid;
  }

  /**
   * Teste l'authentification avec le backend
   */
  testAuth(): Observable<any> {
    console.log('🧪 [API] GET /dashboard/test-auth');
    const headers = this.getHeaders();
    
    return this.http.get(`${this.apiUrl}/dashboard/test-auth`, { headers }).pipe(
      timeout(10000),
      tap(response => console.log('✅ Test auth réussi')),
      catchError(error => {
        console.error('❌ Test auth échoué:', error.status);
        return this.handleError(error, 'testAuth');
      })
    );
  }

  // ============================================
  // MÉTHODES UTILITAIRES
  // ============================================

  /**
   * Invalide le cache du dashboard
   */
  invalidateDashboardCache(): void {
    this.lastDashboardFetch = 0;
    this.todayDashboardCache.next(null);
    console.log('🗑️ Cache dashboard invalidé');
  }

  /**
   * Rafraîchit toutes les données (dashboard, activités, captures)
   */
  refreshAllData(): Observable<any> {
    console.log('🔄 Rafraîchissement de toutes les données...');
    
    return forkJoin({
      dashboard: this.getTodayDashboard(true),
      activityStats: this.getTodayActivityStats(),
      screenshots: this.getTodayScreenshots(),
      tasks: this.getUserTasks(),
      leaveRequests: this.getMyLeaveRequests()
    }).pipe(
      tap(() => console.log('✅ Toutes les données rafraîchies')),
      catchError(error => {
        console.error('❌ Erreur lors du rafraîchissement:', error);
        return of({ dashboard: null, activityStats: null, screenshots: null, tasks: null, leaveRequests: null });
      })
    );
  }

  /**
   * Démarre le polling périodique des données (toutes les X secondes)
   * @param intervalMs - Intervalle en millisecondes
   */
  startPolling(intervalMs: number = 60000): Observable<any> {
    console.log(`🔄 Démarrage du polling toutes les ${intervalMs / 1000} secondes`);
    
    return timer(0, intervalMs).pipe(
      switchMap(() => this.refreshAllData()),
      catchError(error => {
        console.error('❌ Erreur polling:', error);
        return of(null);
      })
    );
  }

  /**
   * Récupère l'URL de l'API (utile pour les tests)
   */
  getApiUrl(): string {
    return this.apiUrl;
  }
}