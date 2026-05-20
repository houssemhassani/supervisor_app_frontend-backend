// src/app/core/services/ai-score.service.ts
/**
 * Service IA pour le calcul de productivité
 * Communique avec le serveur Flask IA (http://localhost:5001)
 * Version: 2.1.0
 */

import { Injectable, NgZone } from '@angular/core';
import { HttpClient, HttpHeaders, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Observable, throwError, of, BehaviorSubject, timer } from 'rxjs';
import { catchError, retry, timeout, map, shareReplay, switchMap, tap, delay } from 'rxjs/operators';
import { environment } from '../../environments/environment';

// ============================================
// INTERFACES ET TYPES
// ============================================

export interface ScreenshotData {
  total: number;
  identical: number;
  avg_similarity: number;
}

export interface ActivityData {
  avg_activity_level: number;
  keyboard_clicks: number;
  mouse_clicks: number;
}

export interface AttendanceData {
  days_present: number;
  days_late: number;
  total_work_hours: number;
}

export interface TasksData {
  total: number;
  completed: number;
  completion_rate: number;
}

export interface ProductivityInput {
  employee_id: number;
  screenshots: ScreenshotData;
  activity: ActivityData;
  attendance: AttendanceData;
  tasks: TasksData;
}

export interface PenaltyBonusDetail {
  name: string;
  value: number;
  description: string;
}

export interface RecommendationDetailed {
  type: string;
  priority: 'high' | 'medium' | 'low' | 'success';
  message: string;
  action: string;
  impact: string;
}

export interface ProductivityResponse {
  success: boolean;
  employee_id: number;
  score: number;
  raw_score: number;
  level: string;
  level_icon: string;
  level_color: string;
  recommendations: string[];
  recommendations_detailed: RecommendationDetailed[];
  details: {
    productivity: number;
    activity_score: number;
    tasks_score: number;
    attendance_score: number;
    penalties: PenaltyBonusDetail[];
    bonuses: PenaltyBonusDetail[];
  };
  metadata: {
    calculated_at: string;
    version: string;
    cache_hit: boolean;
  };
}

export interface BatchProductivityResponse {
  success: boolean;
  results: {
    employee_id: number;
    score: number;
    level: string;
    level_icon: string;
    success: boolean;
    error?: string;
  }[];
  summary: {
    total: number;
    successful: number;
    failed: number;
    average_score: number;
    best_score: number;
    worst_score: number;
  };
  metadata: {
    calculated_at: string;
    version: string;
  };
}

export interface IAConfig {
  version: string;
  thresholds: {
    identical_penalty: number;
    low_activity_penalty: number;
    high_activity_bonus: number;
    late_penalty: number;
    keyboard_bonus_threshold: number;
    mouse_bonus_threshold: number;
    expected_daily_hours: number;
    tasks_bonus_factor: number;
  };
  cache: {
    enabled: boolean;
    ttl_seconds: number;
  };
  rate_limits: {
    per_minute: number;
    per_hour: number;
  };
}

// ============================================
// CACHE LOCAL POUR LES SCORES IA
// ============================================

interface CachedScore {
  data: ProductivityResponse;
  timestamp: number;
  expiresAt: number;
}

@Injectable({
  providedIn: 'root'
})
export class AiScoreService {
  // Configuration
  private iaApiUrl: string;
  private defaultTimeout = 15000; // 15 secondes
  private maxRetries = 2;
  
  // Cache local
  private scoreCache = new Map<number, CachedScore>();
  private cacheTTL = 300000; // 5 minutes (300000 ms)
  
  // Rate limiting client-side
  private lastRequestTime = 0;
  private minRequestInterval = 1000; // 1 seconde entre les requêtes
  
  // États
  private isOnlineSubject = new BehaviorSubject<boolean>(true);
  public isOnline$ = this.isOnlineSubject.asObservable();
  
  // Configuration IA (cachée)
  private iaConfigSubject = new BehaviorSubject<IAConfig | null>(null);
  public iaConfig$ = this.iaConfigSubject.asObservable();

  constructor(
    private http: HttpClient,
    private ngZone: NgZone
  ) {
    // Déterminer l'URL de l'API IA
    this.iaApiUrl =  'http://localhost:5001/api';
    console.log(`🤖 [AiScoreService] Initialisé avec URL: ${this.iaApiUrl}`);
    
    // Vérifier la santé du serveur IA au démarrage
    this.checkHealthWithRetry();
    
    // Charger la configuration IA
    this.loadIAConfig();
  }

  // ============================================
  // MÉTHODES PRIVÉES
  // ============================================

  private getHeaders(): HttpHeaders {
    const token = localStorage.getItem('token') || localStorage.getItem('jwt');
    
    let headers = new HttpHeaders({
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    });
    
    if (token) {
      headers = headers.set('Authorization', `Bearer ${token}`);
    }
    
    return headers;
  }

  private handleError(error: HttpErrorResponse, context: string): Observable<never> {
    let errorMessage = 'Erreur lors de la communication avec le serveur IA';
    
    console.error(`❌ [AiScoreService] ${context}:`, error);
    
    if (error.error instanceof ErrorEvent) {
      // Erreur côté client
      errorMessage = `Erreur réseau: ${error.error.message}`;
      if (error.error.message.includes('ECONNREFUSED')) {
        errorMessage = '⚠️ Serveur IA non accessible. Vérifiez qu\'il est démarré sur le port 5001.';
        this.isOnlineSubject.next(false);
      }
    } else {
      // Erreur côté serveur
      switch (error.status) {
        case 0:
          errorMessage = 'Impossible de se connecter au serveur IA. Vérifiez que Flask est démarré.';
          this.isOnlineSubject.next(false);
          break;
        case 429:
          errorMessage = 'Trop de requêtes. Veuillez réessayer dans quelques instants.';
          break;
        case 500:
          errorMessage = 'Erreur interne du serveur IA.';
          break;
        default:
          errorMessage = error.error?.error || error.message || `Erreur ${error.status}`;
      }
    }
    
    return throwError(() => new Error(errorMessage));
  }

  private async checkRateLimit(): Promise<boolean> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    
    if (timeSinceLastRequest < this.minRequestInterval) {
      const waitTime = this.minRequestInterval - timeSinceLastRequest;
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    
    this.lastRequestTime = Date.now();
    return true;
  }

  private getCachedScore(employeeId: number): ProductivityResponse | null {
    const cached = this.scoreCache.get(employeeId);
    if (cached && cached.expiresAt > Date.now()) {
      console.log(`💾 [Cache] Score IA trouvé pour employé ${employeeId} (expire dans ${Math.round((cached.expiresAt - Date.now()) / 1000)}s)`);
      return cached.data;
    }
    
    if (cached) {
      this.scoreCache.delete(employeeId);
    }
    return null;
  }

  private setCachedScore(employeeId: number, data: ProductivityResponse): void {
    this.scoreCache.set(employeeId, {
      data,
      timestamp: Date.now(),
      expiresAt: Date.now() + this.cacheTTL
    });
    console.log(`💾 [Cache] Score IA mis en cache pour employé ${employeeId} (valide 5 min)`);
  }

  private clearExpiredCache(): void {
    const now = Date.now();
    let clearedCount = 0;
    
    for (const [id, cached] of this.scoreCache.entries()) {
      if (cached.expiresAt <= now) {
        this.scoreCache.delete(id);
        clearedCount++;
      }
    }
    
    if (clearedCount > 0) {
      console.log(`🧹 [Cache] ${clearedCount} entrées expirées supprimées`);
    }
  }

  // ============================================
  // MÉTHODES PUBLIQUES PRINCIPALES
  // ============================================

  /**
   * Calcule le score de productivité pour un employé
   * @param employeeData - Données de l'employé (screenshots, activité, présence, tâches)
   * @param useCache - Utiliser le cache local (défaut: true)
   */
  calculateScore(employeeData: ProductivityInput, useCache: boolean = true): Observable<ProductivityResponse> {
    // Vérifier le cache
    if (useCache) {
      const cached = this.getCachedScore(employeeData.employee_id);
      if (cached) {
        return of(cached);
      }
    }
    
    // Nettoyer le cache expiré périodiquement
    this.clearExpiredCache();
    
    // Validation des données d'entrée
    const validationError = this.validateInputData(employeeData);
    if (validationError) {
      return throwError(() => new Error(validationError));
    }
    
    return this.http.post<ProductivityResponse>(
      `${this.iaApiUrl}/calculate-score`,
      employeeData,
      { 
        headers: this.getHeaders(),
        timeout: this.defaultTimeout
      }
    ).pipe(
      timeout(this.defaultTimeout),
      retry(this.maxRetries),
      tap(response => {
        if (response.success) {
          this.setCachedScore(employeeData.employee_id, response);
          this.isOnlineSubject.next(true);
        }
      }),
      catchError(error => this.handleError(error, 'calculateScore')),
      map(response => this.enrichResponse(response, employeeData))
    );
  }

  /**
   * Calcule les scores pour plusieurs employés (batch)
   * @param employeesData - Liste des données des employés
   */
  calculateBatchScores(employeesData: ProductivityInput[]): Observable<BatchProductivityResponse> {
    if (!employeesData || employeesData.length === 0) {
      return throwError(() => new Error('Liste d\'employés vide'));
    }
    
    if (employeesData.length > 50) {
      console.warn(`⚠️ Batch: ${employeesData.length} employés - La limite recommandée est 50`);
    }
    
    // Nettoyer le cache avant batch
    this.clearExpiredCache();
    
    return this.http.post<BatchProductivityResponse>(
      `${this.iaApiUrl}/batch-score`,
      { employees: employeesData },
      { 
        headers: this.getHeaders(),
        timeout: this.defaultTimeout * 2 // Plus de temps pour le batch
      }
    ).pipe(
      timeout(this.defaultTimeout * 2),
      retry(1),
      tap(response => {
        if (response.success) {
          // Mettre en cache chaque score individuellement
          response.results.forEach(result => {
            if (result.success && result.score) {
              // Créer une entrée de cache pour chaque employé
              const mockResponse = {
                success: true,
                employee_id: result.employee_id,
                score: result.score,
                raw_score: result.score,
                level: result.level,
                level_icon: result.level_icon,
                level_color: '',
                recommendations: [],
                recommendations_detailed: [],
                details: {
                  productivity: result.score,
                  activity_score: 0,
                  tasks_score: 0,
                  attendance_score: 0,
                  penalties: [],
                  bonuses: []
                },
                metadata: {
                  calculated_at: response.metadata.calculated_at,
                  version: response.metadata.version,
                  cache_hit: false
                }
              };
              this.setCachedScore(result.employee_id, mockResponse);
            }
          });
          this.isOnlineSubject.next(true);
        }
      }),
      catchError(error => this.handleError(error, 'calculateBatchScores'))
    );
  }

  /**
   * Vérifie la santé du serveur IA
   */
  checkHealth(): Observable<{ status: string; service: string; version: string }> {
    return this.http.get<{ status: string; service: string; version: string }>(
      `${this.iaApiUrl}/health`,
      { timeout: 5000 }
    ).pipe(
      tap(() => {
        if (!this.isOnlineSubject.value) {
          this.isOnlineSubject.next(true);
          console.log('✅ Serveur IA reconnecté');
        }
      }),
      catchError(error => {
        this.isOnlineSubject.next(false);
        console.warn('⚠️ Serveur IA indisponible');
        return throwError(() => error);
      })
    );
  }

  /**
   * Vérification avec retry automatique
   */
  checkHealthWithRetry(retryCount: number = 3, delayMs: number = 2000): void {
    this.checkHealth().subscribe({
      next: (response) => {
        console.log(`✅ Serveur IA: ${response.service} v${response.version}`);
      },
      error: () => {
        if (retryCount > 0) {
          console.log(`🔄 Nouvelle tentative de connexion à l'IA dans ${delayMs/1000}s... (${retryCount} restantes)`);
          setTimeout(() => this.checkHealthWithRetry(retryCount - 1, delayMs), delayMs);
        } else {
          console.error('❌ Serveur IA injoignable après plusieurs tentatives');
        }
      }
    });
  }

  /**
   * Récupère la configuration du serveur IA
   */
  getIAConfig(): Observable<IAConfig> {
    // Vérifier si la config est déjà en cache
    if (this.iaConfigSubject.value) {
      return of(this.iaConfigSubject.value);
    }
    
    return this.http.get<IAConfig>(`${this.iaApiUrl}/config`, { timeout: 5000 }).pipe(
      tap(config => {
        this.iaConfigSubject.next(config);
        console.log('📋 Configuration IA chargée:', config.version);
      }),
      catchError(error => {
        console.warn('⚠️ Impossible de charger la configuration IA', error);
        return of(this.getDefaultConfig());
      })
    );
  }

  private loadIAConfig(): void {
    this.getIAConfig().subscribe();
  }

  private getDefaultConfig(): IAConfig {
    return {
      version: 'unknown',
      thresholds: {
        identical_penalty: 30,
        low_activity_penalty: 15,
        high_activity_bonus: 10,
        late_penalty: 5,
        keyboard_bonus_threshold: 5000,
        mouse_bonus_threshold: 3000,
        expected_daily_hours: 8,
        tasks_bonus_factor: 0.15
      },
      cache: {
        enabled: true,
        ttl_seconds: 300
      },
      rate_limits: {
        per_minute: 30,
        per_hour: 200
      }
    };
  }

  /**
   * Vide le cache des scores
   */
  clearCache(): void {
    this.scoreCache.clear();
    console.log('🧹 Cache IA vidé');
  }

  /**
   * Invalide le cache pour un employé spécifique
   */
  invalidateCache(employeeId: number): void {
    if (this.scoreCache.delete(employeeId)) {
      console.log(`🗑️ Cache invalidé pour employé ${employeeId}`);
    }
  }

  /**
   * Récupère les statistiques du cache
   */
  getCacheStats(): { size: number; keys: number[] } {
    const keys = Array.from(this.scoreCache.keys());
    return { size: keys.length, keys };
  }

  /**
   * Récupère le score d'un employé depuis le cache uniquement
   */
  getScoreFromCache(employeeId: number): ProductivityResponse | null {
    return this.getCachedScore(employeeId);
  }

  /**
   * Récupère les métriques de productivité formatées pour l'affichage
   */
  getFormattedScore(score: number, level: string): { color: string; icon: string; text: string } {
    if (score >= 90) {
      return { color: '#10b981', icon: '🎉', text: 'Excellent' };
    } else if (score >= 75) {
      return { color: '#3b82f6', icon: '👍', text: 'Bon' };
    } else if (score >= 60) {
      return { color: '#f59e0b', icon: '📊', text: 'Moyen' };
    } else if (score >= 40) {
      return { color: '#ef4444', icon: '⚠️', text: 'Faible' };
    } else {
      return { color: '#dc2626', icon: '🔴', text: 'Critique' };
    }
  }

  /**
   * Récupère le message de recommandation principal basé sur le score
   */
  getMainRecommendation(score: number): string {
    if (score >= 90) {
      return '🏆 Performance exceptionnelle ! Continuez sur cette lancée.';
    } else if (score >= 75) {
      return '📈 Bonne performance ! Quelques ajustements peuvent vous rendre encore meilleur.';
    } else if (score >= 60) {
      return '⚡ Potentiel d\'amélioration. Suivez les recommandations ci-dessous.';
    } else {
      return '🚨 Attention : votre productivité est préoccupante. Consultez les conseils immédiatement.';
    }
  }

  // ============================================
  // MÉTHODES DE CONSTRUCTION DES DONNÉES
  // ============================================

  /**
   * Construit les données d'entrée pour l'IA à partir des données brutes
   */
  buildProductivityInput(
    employeeId: number,
    screenshots: any[],
    activityLogs: any[],
    attendances: any[],
    tasks: any[]
  ): ProductivityInput {
    // Traitement des screenshots
    const totalScreenshots = screenshots?.length || 0;
    const identicalScreenshots = screenshots?.filter(s => s.is_identical === true).length || 0;
    const avgSimilarity = totalScreenshots > 0
      ? screenshots.reduce((sum, s) => sum + (s.similarity_score || 100), 0) / totalScreenshots
      : 100;
    
    // Traitement des logs d'activité
    const totalKeyboard = activityLogs?.reduce((sum, log) => sum + (log.keyboard_clicks || 0), 0) || 0;
    const totalMouse = activityLogs?.reduce((sum, log) => sum + (log.mouse_clicks || 0), 0) || 0;
    const avgActivity = activityLogs?.length > 0
      ? activityLogs.reduce((sum, log) => sum + (log.activity_level || 0), 0) / activityLogs.length
      : 50;
    
    // Traitement des présences
    const daysPresent = attendances?.filter(a => a.statuts === 'PRESENT' || a.statuts === 'LATE').length || 0;
    const daysLate = attendances?.filter(a => a.statuts === 'LATE').length || 0;
    const totalWorkHours = attendances?.reduce((sum, a) => sum + (a.work_hours || 0), 0) || 0;
    
    // Traitement des tâches
    const totalTasks = tasks?.length || 0;
    const completedTasks = tasks?.filter(t => t.statuts === 'DONE').length || 0;
    const completionRate = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;
    
    return {
      employee_id: employeeId,
      screenshots: {
        total: totalScreenshots,
        identical: identicalScreenshots,
        avg_similarity: Math.round(avgSimilarity)
      },
      activity: {
        avg_activity_level: Math.round(avgActivity),
        keyboard_clicks: totalKeyboard,
        mouse_clicks: totalMouse
      },
      attendance: {
        days_present: daysPresent,
        days_late: daysLate,
        total_work_hours: totalWorkHours
      },
      tasks: {
        total: totalTasks,
        completed: completedTasks,
        completion_rate: Math.round(completionRate)
      }
    };
  }

  /**
   * Construit les données pour un employé à partir de l'API Strapi
   */
  async buildInputFromStrapiData(
    employeeId: number,
    screenshotsResponse: any,
    activityResponse: any,
    attendanceResponse: any,
    tasksResponse: any
  ): Promise<ProductivityInput> {
    const screenshots = screenshotsResponse?.data || [];
    const activityLogs = activityResponse?.data || [];
    const attendances = attendanceResponse?.data || [];
    const tasks = tasksResponse?.data || [];
    
    return this.buildProductivityInput(employeeId, screenshots, activityLogs, attendances, tasks);
  }

  // ============================================
  // VALIDATION DES DONNÉES
  // ============================================

  private validateInputData(data: ProductivityInput): string | null {
    if (!data.employee_id || data.employee_id <= 0) {
      return 'ID employé invalide';
    }
    
    if (data.screenshots.total < 0) {
      return 'Nombre de captures invalide';
    }
    
    if (data.activity.avg_activity_level < 0 || data.activity.avg_activity_level > 100) {
      return 'Niveau d\'activité invalide (0-100)';
    }
    
    if (data.attendance.days_present < 0) {
      return 'Nombre de jours présents invalide';
    }
    
    if (data.tasks.completion_rate < 0 || data.tasks.completion_rate > 100) {
      return 'Taux de complétion invalide (0-100)';
    }
    
    return null;
  }

  private enrichResponse(response: ProductivityResponse, input: ProductivityInput): ProductivityResponse {
    // Ajouter des métriques supplémentaires si nécessaire
    return {
      ...response,
      details: {
        ...response.details,
        // Ajouter des informations supplémentaires
        activity_score: response.details.activity_score || input.activity.avg_activity_level,
        tasks_score: response.details.tasks_score || input.tasks.completion_rate,
        attendance_score: response.details.attendance_score || 
          (input.attendance.total_work_hours / (8 * input.attendance.days_present)) * 100 || 0
      }
    };
  }

  // ============================================
  // MÉTHODES UTILITAIRES
  // ============================================

  /**
   * Rafraîchit périodiquement les scores (polling)
   * @param employeeId - ID de l'employé
   * @param intervalMs - Intervalle en millisecondes
   */
  startPeriodicScoreRefresh(employeeId: number, intervalMs: number = 300000): Observable<ProductivityResponse> {
    // Rafraîchir immédiatement puis à intervalle régulier
    return timer(0, intervalMs).pipe(
      switchMap(() => {
        // Invalider le cache avant de rafraîchir
        this.invalidateCache(employeeId);
        // Ici vous devriez récupérer les données récentes
        // Pour l'instant, on retourne une erreur car il faut les données
        return throwError(() => new Error('Méthode à implémenter avec les données réelles'));
      })
    );
  }

  /**
   * Vérifie si le serveur IA est accessible
   */
  isServerOnline(): boolean {
    return this.isOnlineSubject.value;
  }

  /**
   * Réinitialise le service (utile pour les tests)
   */
  reset(): void {
    this.clearCache();
    this.lastRequestTime = 0;
    this.isOnlineSubject.next(true);
    console.log('🔄 AiScoreService réinitialisé');
  }
}