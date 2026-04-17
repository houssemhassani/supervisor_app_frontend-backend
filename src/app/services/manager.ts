import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError, of } from 'rxjs';
import { catchError, tap, map } from 'rxjs/operators';
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
  role?: {
    id: number;
    name: string;
    type: string;
  };
}

export interface LeaveRequest {
  id: number;
  type: 'ANNUAL' | 'SICK' | 'PERSONAL' | 'UNPAID' | 'MATERNITY' | 'OTHER';
  start_date: string;
  end_date: string;
  duration_days: number;
  reason: string;
  statuts: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
  user?: User;
  manager_comments?: string;
  approval_date?: string;
  rejection_date?: string;
  created_at?: string;
  updated_at?: string;
}

export interface Task {
  id: number;
  title: string;
  description: string;
  statuts: 'TODO' | 'IN_PROGRESS' | 'DONE';
  priority: 'LOW' | 'MEDIUM' | 'HIGH';
  due_date: string;
  assigned_to?: User;
  project?: {
    id: number;
    name: string;
  };
  created_at?: string;
  updated_at?: string;
}

export interface Project {
  id: number;
  name: string;
  description: string;
  statuts: 'PLANNED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  start_date: string;
  end_date: string;
  users?: User[];
  creator?: User;
  created_at?: string;
  updated_at?: string;
}

export interface DashboardStats {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
  cancelled: number;
  byType: {
    ANNUAL: number;
    SICK: number;
    PERSONAL: number;
    UNPAID: number;
    MATERNITY: number;
    OTHER: number;
  };
  totalDaysApproved: number;
  averageResponseTime?: number;
}

export interface ApiResponse<T = any> {
  data: T;
  meta?: {
    pagination?: {
      page: number;
      pageSize: number;
      pageCount: number;
      total: number;
    };
  };
}

@Injectable({
  providedIn: 'root'
})
export class ManagerService {
  private apiUrl: string;
  private currentUser: User | null = null;

  constructor(private http: HttpClient) {
    this.apiUrl = environment.apiUrl || 'http://localhost:1337/api';
    this.loadCurrentUser();
  }

  // ============================================
  // MÉTHODES PRIVÉES - UTILITAIRES
  // ============================================

  private loadCurrentUser(): void {
    const userStr = localStorage.getItem('user');
    if (userStr) {
      try {
        this.currentUser = JSON.parse(userStr);
      } catch (e) {
        console.error('Erreur parsing user:', e);
      }
    }
  }

  private getHeaders(): HttpHeaders {
    const token = localStorage.getItem('token') || localStorage.getItem('jwt');
    
    if (!token) {
      console.warn('⚠️ Aucun token trouvé');
      return new HttpHeaders({ 'Content-Type': 'application/json' });
    }
    
    return new HttpHeaders({
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    });
  }

  private getUserId(): number | null {
    // Essayer depuis l'objet user stocké
    if (this.currentUser?.id) {
      return this.currentUser.id;
    }
    
    // Essayer depuis le localStorage
    const userStr = localStorage.getItem('user');
    if (userStr) {
      try {
        const user = JSON.parse(userStr);
        if (user.id) return user.id;
      } catch(e) {}
    }
    
    // Essayer depuis le token JWT
    const token = localStorage.getItem('token') || localStorage.getItem('jwt');
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        return payload.id || payload.userId || payload.sub;
      } catch(e) {}
    }
    
    return null;
  }

  private isManager(): boolean {
    if (this.currentUser?.role?.type === 'MANAGER') return true;
    if (this.currentUser?.role?.name === 'MANAGER') return true;
    
    const userStr = localStorage.getItem('user');
    if (userStr) {
      try {
        const user = JSON.parse(userStr);
        const role = user.role?.type || user.role?.name;
        return role === 'MANAGER' || role === 'ADMIN' || user.isManager === true;
      } catch(e) {}
    }
    return false;
  }

  private handleError(error: HttpErrorResponse, customMessage?: string): Observable<never> {
    let errorMessage = customMessage || 'Une erreur est survenue';
    
    if (error.error instanceof ErrorEvent) {
      // Erreur côté client
      errorMessage = `Erreur: ${error.error.message}`;
    } else {
      // Erreur côté serveur
      switch (error.status) {
        case 400:
          errorMessage = error.error?.message || 'Requête invalide';
          break;
        case 401:
          errorMessage = 'Non authentifié. Veuillez vous reconnecter.';
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
        case 500:
          errorMessage = 'Erreur serveur. Veuillez réessayer plus tard.';
          break;
        default:
          errorMessage = error.error?.message || `Erreur ${error.status}: ${error.statusText}`;
      }
    }
    
    console.error('❌ Erreur API:', error);
    return throwError(() => new Error(errorMessage));
  }

  // ============================================
  // LEAVE REQUESTS - CRUD COMPLET
  // ============================================

  /**
   * Récupérer toutes les demandes de congé (Manager/Admin uniquement)
   */
  getAllLeaveRequests(filters?: {
    status?: string;
    type?: string;
    startDate?: string;
    endDate?: string;
    userId?: number;
  }): Observable<ApiResponse<LeaveRequest[]>> {
    let url = `${this.apiUrl}/leave-requests?sort=createdAt:desc&populate=user`;
    
    if (filters) {
      if (filters.status) url += `&filters[statuts][$eq]=${filters.status}`;
      if (filters.type) url += `&filters[type][$eq]=${filters.type}`;
      if (filters.userId) url += `&filters[user][id][$eq]=${filters.userId}`;
      if (filters.startDate) url += `&filters[start_date][$gte]=${filters.startDate}`;
      if (filters.endDate) url += `&filters[end_date][$lte]=${filters.endDate}`;
    }
    
    console.log('📡 [Manager] GET toutes les demandes');
    const headers = this.getHeaders();
    
    return this.http.get<ApiResponse<LeaveRequest[]>>(url, { headers }).pipe(
      tap(response => console.log(`✅ ${response.data?.length || 0} demandes trouvées`)),
      catchError(error => this.handleError(error, 'Erreur lors du chargement des demandes'))
    );
  }

  /**
   * Récupérer mes demandes de congé
   */
  getMyLeaveRequests(filters?: {
    status?: string;
    type?: string;
  }): Observable<ApiResponse<LeaveRequest[]>> {
    const userId = this.getUserId();
    if (!userId) {
      return throwError(() => new Error('Utilisateur non connecté'));
    }
    
    let url = `${this.apiUrl}/leave-requests?sort=createdAt:desc&populate=user&filters[user][id][$eq]=${userId}`;
    
    if (filters) {
      if (filters.status) url += `&filters[statuts][$eq]=${filters.status}`;
      if (filters.type) url += `&filters[type][$eq]=${filters.type}`;
    }
    
    console.log('📡 [Manager] GET mes demandes');
    const headers = this.getHeaders();
    
    return this.http.get<ApiResponse<LeaveRequest[]>>(url, { headers }).pipe(
      tap(response => console.log(`✅ ${response.data?.length || 0} demandes personnelles`)),
      catchError(error => this.handleError(error, 'Erreur lors du chargement de vos demandes'))
    );
  }

  /**
   * Récupérer une demande spécifique par son ID
   */
  getLeaveRequestById(id: number): Observable<ApiResponse<LeaveRequest>> {
    const url = `${this.apiUrl}/leave-requests/${id}?populate=user`;
    console.log(`📡 [Manager] GET demande #${id}`);
    const headers = this.getHeaders();
    
    return this.http.get<ApiResponse<LeaveRequest>>(url, { headers }).pipe(
      tap(response => console.log(`✅ Demande #${id} trouvée`)),
      catchError(error => this.handleError(error, `Erreur lors du chargement de la demande #${id}`))
    );
  }

  /**
   * Créer une nouvelle demande de congé
   */
  createLeaveRequest(data: {
    type: string;
    start_date: string;
    end_date: string;
    reason: string;
  }): Observable<ApiResponse<LeaveRequest>> {
    const token = localStorage.getItem('token') || localStorage.getItem('jwt');
    
    if (!token) {
      return throwError(() => new Error('Non authentifié'));
    }
    
    const userId = this.getUserId();
    if (!userId) {
      return throwError(() => new Error('Utilisateur non connecté'));
    }
    
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    });

    // Calculer la durée
    const start = new Date(data.start_date);
    const end = new Date(data.end_date);
    const durationDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 3600 * 24)) + 1;

    const payload = {
      data: {
        type: data.type,
        start_date: data.start_date,
        end_date: data.end_date,
        duration_days: durationDays,
        reason: data.reason,
        statuts: 'PENDING',
        user: userId
      }
    };

    console.log('📝 [Manager] POST nouvelle demande');
    
    return this.http.post<ApiResponse<LeaveRequest>>(`${this.apiUrl}/leave-requests`, payload, { headers }).pipe(
      tap(response => console.log(`✅ Demande créée avec l'ID ${response.data.id}`)),
      catchError(error => this.handleError(error, 'Erreur lors de la création de la demande'))
    );
  }

  /**
   * Mettre à jour une demande de congé
   */
  updateLeaveRequest(id: number, data: {
    type?: string;
    start_date?: string;
    end_date?: string;
    reason?: string;
  }): Observable<ApiResponse<LeaveRequest>> {
    const token = localStorage.getItem('token') || localStorage.getItem('jwt');
    
    if (!token) {
      return throwError(() => new Error('Non authentifié'));
    }
    
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    });

    const updateData: any = {};
    if (data.type) updateData.type = data.type;
    if (data.reason) updateData.reason = data.reason;
    
    if (data.start_date && data.end_date) {
      updateData.start_date = data.start_date;
      updateData.end_date = data.end_date;
      const start = new Date(data.start_date);
      const end = new Date(data.end_date);
      updateData.duration_days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 3600 * 24)) + 1;
    } else {
      if (data.start_date) updateData.start_date = data.start_date;
      if (data.end_date) updateData.end_date = data.end_date;
    }

    const payload = { data: updateData };
    
    console.log(`📝 [Manager] PUT demande #${id}`);
    
    return this.http.put<ApiResponse<LeaveRequest>>(`${this.apiUrl}/leave-requests/${id}`, payload, { headers }).pipe(
      tap(response => console.log(`✅ Demande #${id} modifiée`)),
      catchError(error => this.handleError(error, `Erreur lors de la modification de la demande #${id}`))
    );
  }

  /**
   * Supprimer une demande de congé
   */
  deleteLeaveRequest(id: number): Observable<any> {
    const token = localStorage.getItem('token') || localStorage.getItem('jwt');
    
    if (!token) {
      return throwError(() => new Error('Non authentifié'));
    }
    
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    });
    
    console.log(`🗑️ [Manager] DELETE demande #${id}`);
    
    return this.http.delete(`${this.apiUrl}/leave-requests/${id}`, { headers }).pipe(
      tap(() => console.log(`✅ Demande #${id} supprimée`)),
      catchError(error => this.handleError(error, `Erreur lors de la suppression de la demande #${id}`))
    );
  }

  /**
   * Approuver une demande de congé (Manager uniquement)
   */
  approveLeaveRequest(id: number, comments?: string): Observable<ApiResponse<LeaveRequest>> {
    const token = localStorage.getItem('token') || localStorage.getItem('jwt');
    
    if (!token) {
      return throwError(() => new Error('Non authentifié'));
    }
    
    if (!this.isManager()) {
      return throwError(() => new Error('Droits insuffisants pour approuver une demande'));
    }
    
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    });
    
    const payload = comments ? { comments } : {};
    
    console.log(`✅ [Manager] POST approve demande #${id}`);
    
    return this.http.post<ApiResponse<LeaveRequest>>(`${this.apiUrl}/leave-requests/${id}/approve`, payload, { headers }).pipe(
      tap(response => console.log(`✅ Demande #${id} approuvée`)),
      catchError(error => this.handleError(error, `Erreur lors de l'approbation de la demande #${id}`))
    );
  }

  /**
   * Rejeter une demande de congé (Manager uniquement)
   */
  rejectLeaveRequest(id: number, comments?: string): Observable<ApiResponse<LeaveRequest>> {
    const token = localStorage.getItem('token') || localStorage.getItem('jwt');
    
    if (!token) {
      return throwError(() => new Error('Non authentifié'));
    }
    
    if (!this.isManager()) {
      return throwError(() => new Error('Droits insuffisants pour rejeter une demande'));
    }
    
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    });
    
    const payload = comments ? { comments } : {};
    
    console.log(`❌ [Manager] POST reject demande #${id}`);
    
    return this.http.post<ApiResponse<LeaveRequest>>(`${this.apiUrl}/leave-requests/${id}/reject`, payload, { headers }).pipe(
      tap(response => console.log(`❌ Demande #${id} rejetée`)),
      catchError(error => this.handleError(error, `Erreur lors du rejet de la demande #${id}`))
    );
  }

  /**
   * Annuler une demande de congé
   */
  cancelLeaveRequest(id: number): Observable<ApiResponse<LeaveRequest>> {
    const token = localStorage.getItem('token') || localStorage.getItem('jwt');
    
    if (!token) {
      return throwError(() => new Error('Non authentifié'));
    }
    
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    });
    
    const payload = {
      data: { statuts: 'CANCELLED' }
    };
    
    console.log(`🔄 [Manager] PUT cancel demande #${id}`);
    
    return this.http.put<ApiResponse<LeaveRequest>>(`${this.apiUrl}/leave-requests/${id}`, payload, { headers }).pipe(
      tap(response => console.log(`🔄 Demande #${id} annulée`)),
      catchError(error => this.handleError(error, `Erreur lors de l'annulation de la demande #${id}`))
    );
  }

  /**
   * Vérifier si une demande peut être modifiée
   */
  canEditLeaveRequest(request: LeaveRequest): boolean {
    // Une demande peut être modifiée si elle est en attente
    // ou si l'utilisateur est manager/admin
    const isPending = request.statuts === 'PENDING';
    const isManagerOrAdmin = this.isManager();
    
    return isPending || isManagerOrAdmin;
  }

  /**
   * Récupérer les statistiques des congés
   */
  getLeaveStats(): Observable<ApiResponse<DashboardStats>> {
    const url = `${this.apiUrl}/leave-requests/stats`;
    const headers = this.getHeaders();
    
    // Données mockées par défaut
    const mockStats: ApiResponse<DashboardStats> = {
      data: {
        total: 0,
        pending: 0,
        approved: 0,
        rejected: 0,
        cancelled: 0,
        byType: {
          ANNUAL: 0,
          SICK: 0,
          PERSONAL: 0,
          UNPAID: 0,
          MATERNITY: 0,
          OTHER: 0
        },
        totalDaysApproved: 0,
        averageResponseTime: 0
      }
    };
    
    return this.http.get<ApiResponse<DashboardStats>>(url, { headers }).pipe(
      tap(response => console.log('📊 Statistiques congés reçues', response)),
      catchError(error => {
        console.warn('⚠️ Endpoint stats non disponible, utilisation de données mockées');
        return of(mockStats);
      })
    );
  }

  // ============================================
  // TASKS - CRUD COMPLET
  // ============================================

  /**
   * Récupérer toutes les tâches
   */
  getAllTasks(filters?: {
    status?: string;
    priority?: string;
    assignedTo?: number;
  }): Observable<ApiResponse<Task[]>> {
    let url = `${this.apiUrl}/tasks?sort=due_date:asc&populate=assigned_to&populate=project`;
    
    if (filters) {
      if (filters.status) url += `&filters[statuts][$eq]=${filters.status}`;
      if (filters.priority) url += `&filters[priority][$eq]=${filters.priority}`;
      if (filters.assignedTo) url += `&filters[assigned_to][id][$eq]=${filters.assignedTo}`;
    }
    
    console.log('📡 [Manager] GET toutes les tâches');
    const headers = this.getHeaders();
    
    return this.http.get<ApiResponse<Task[]>>(url, { headers }).pipe(
      tap(response => console.log(`✅ ${response.data?.length || 0} tâches trouvées`)),
      catchError(error => this.handleError(error, 'Erreur lors du chargement des tâches'))
    );
  }

  /**
   * Récupérer mes tâches
   */
  getMyTasks(): Observable<ApiResponse<Task[]>> {
    const userId = this.getUserId();
    if (!userId) {
      return throwError(() => new Error('Utilisateur non connecté'));
    }
    
    const url = `${this.apiUrl}/tasks?sort=due_date:asc&populate=assigned_to&populate=project&filters[assigned_to][id][$eq]=${userId}`;
    console.log('📡 [Manager] GET mes tâches');
    const headers = this.getHeaders();
    
    return this.http.get<ApiResponse<Task[]>>(url, { headers }).pipe(
      tap(response => console.log(`✅ ${response.data?.length || 0} tâches personnelles`)),
      catchError(error => this.handleError(error, 'Erreur lors du chargement de vos tâches'))
    );
  }

  /**
   * Récupérer une tâche spécifique
   */
  getTaskById(id: number): Observable<ApiResponse<Task>> {
    const url = `${this.apiUrl}/tasks/${id}?populate=assigned_to&populate=project`;
    console.log(`📡 [Manager] GET tâche #${id}`);
    const headers = this.getHeaders();
    
    return this.http.get<ApiResponse<Task>>(url, { headers }).pipe(
      tap(response => console.log(`✅ Tâche #${id} trouvée`)),
      catchError(error => this.handleError(error, `Erreur lors du chargement de la tâche #${id}`))
    );
  }

  /**
   * Créer une nouvelle tâche
   */
  createTask(data: {
    title: string;
    description: string;
    priority: string;
    due_date: string;
    assigned_to?: number;
    project?: number;
  }): Observable<ApiResponse<Task>> {
    const token = localStorage.getItem('token') || localStorage.getItem('jwt');
    
    if (!token) {
      return throwError(() => new Error('Non authentifié'));
    }
    
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    });

    const payload = {
      data: {
        title: data.title,
        description: data.description,
        priority: data.priority,
        statuts: 'TODO',
        due_date: data.due_date,
        assigned_to: data.assigned_to,
        project: data.project
      }
    };

    console.log('📝 [Manager] POST nouvelle tâche');
    
    return this.http.post<ApiResponse<Task>>(`${this.apiUrl}/tasks`, payload, { headers }).pipe(
      tap(response => console.log(`✅ Tâche créée avec l'ID ${response.data.id}`)),
      catchError(error => this.handleError(error, 'Erreur lors de la création de la tâche'))
    );
  }

  /**
   * Mettre à jour une tâche
   */
  updateTask(id: number, data: {
    title?: string;
    description?: string;
    priority?: string;
    statuts?: string;
    due_date?: string;
    assigned_to?: number;
    project?: number;
  }): Observable<ApiResponse<Task>> {
    const token = localStorage.getItem('token') || localStorage.getItem('jwt');
    
    if (!token) {
      return throwError(() => new Error('Non authentifié'));
    }
    
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    });

    const payload = { data };
    
    console.log(`📝 [Manager] PUT tâche #${id}`);
    
    return this.http.put<ApiResponse<Task>>(`${this.apiUrl}/tasks/${id}`, payload, { headers }).pipe(
      tap(response => console.log(`✅ Tâche #${id} modifiée`)),
      catchError(error => this.handleError(error, `Erreur lors de la modification de la tâche #${id}`))
    );
  }

  /**
   * Mettre à jour le statut d'une tâche
   */
  updateTaskStatus(id: number, status: string): Observable<ApiResponse<Task>> {
    return this.updateTask(id, { statuts: status });
  }

  /**
   * Supprimer une tâche
   */
  deleteTask(id: number): Observable<any> {
    const token = localStorage.getItem('token') || localStorage.getItem('jwt');
    
    if (!token) {
      return throwError(() => new Error('Non authentifié'));
    }
    
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    });
    
    console.log(`🗑️ [Manager] DELETE tâche #${id}`);
    
    return this.http.delete(`${this.apiUrl}/tasks/${id}`, { headers }).pipe(
      tap(() => console.log(`✅ Tâche #${id} supprimée`)),
      catchError(error => this.handleError(error, `Erreur lors de la suppression de la tâche #${id}`))
    );
  }

  // ============================================
  // PROJECTS - CRUD COMPLET
  // ============================================

  /**
   * Récupérer tous les projets
   */
  getAllProjects(): Observable<ApiResponse<Project[]>> {
    const url = `${this.apiUrl}/projects?sort=createdAt:desc&populate=users&populate=creator`;
    console.log('📡 [Manager] GET tous les projets');
    const headers = this.getHeaders();
    
    return this.http.get<ApiResponse<Project[]>>(url, { headers }).pipe(
      tap(response => console.log(`✅ ${response.data?.length || 0} projets trouvés`)),
      catchError(error => this.handleError(error, 'Erreur lors du chargement des projets'))
    );
  }

  /**
   * Récupérer mes projets
   */
  getMyProjects(): Observable<ApiResponse<Project[]>> {
    const userId = this.getUserId();
    if (!userId) {
      return throwError(() => new Error('Utilisateur non connecté'));
    }
    
    const url = `${this.apiUrl}/projects?sort=createdAt:desc&populate=users&populate=creator&filters[users][id][$eq]=${userId}`;
    console.log('📡 [Manager] GET mes projets');
    const headers = this.getHeaders();
    
    return this.http.get<ApiResponse<Project[]>>(url, { headers }).pipe(
      tap(response => console.log(`✅ ${response.data?.length || 0} projets personnels`)),
      catchError(error => this.handleError(error, 'Erreur lors du chargement de vos projets'))
    );
  }

  /**
   * Récupérer un projet spécifique
   */
  getProjectById(id: number): Observable<ApiResponse<Project>> {
    const url = `${this.apiUrl}/projects/${id}?populate=users&populate=creator`;
    console.log(`📡 [Manager] GET projet #${id}`);
    const headers = this.getHeaders();
    
    return this.http.get<ApiResponse<Project>>(url, { headers }).pipe(
      tap(response => console.log(`✅ Projet #${id} trouvé`)),
      catchError(error => this.handleError(error, `Erreur lors du chargement du projet #${id}`))
    );
  }

  /**
   * Créer un nouveau projet
   */
  createProject(data: {
    name: string;
    description: string;
    start_date: string;
    end_date: string;
    statuts?: string;
    users?: number[];
  }): Observable<ApiResponse<Project>> {
    const token = localStorage.getItem('token') || localStorage.getItem('jwt');
    
    if (!token) {
      return throwError(() => new Error('Non authentifié'));
    }
    
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    });

    const payload = {
      data: {
        name: data.name,
        description: data.description,
        statuts: data.statuts || 'PLANNED',
        start_date: data.start_date,
        end_date: data.end_date,
        users: data.users
      }
    };

    console.log('📝 [Manager] POST nouveau projet');
    
    return this.http.post<ApiResponse<Project>>(`${this.apiUrl}/projects`, payload, { headers }).pipe(
      tap(response => console.log(`✅ Projet créé avec l'ID ${response.data.id}`)),
      catchError(error => this.handleError(error, 'Erreur lors de la création du projet'))
    );
  }

  /**
   * Mettre à jour un projet
   */
  updateProject(id: number, data: {
    name?: string;
    description?: string;
    statuts?: string;
    start_date?: string;
    end_date?: string;
    users?: number[];
  }): Observable<ApiResponse<Project>> {
    const token = localStorage.getItem('token') || localStorage.getItem('jwt');
    
    if (!token) {
      return throwError(() => new Error('Non authentifié'));
    }
    
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    });

    const payload = { data };
    
    console.log(`📝 [Manager] PUT projet #${id}`);
    
    return this.http.put<ApiResponse<Project>>(`${this.apiUrl}/projects/${id}`, payload, { headers }).pipe(
      tap(response => console.log(`✅ Projet #${id} modifié`)),
      catchError(error => this.handleError(error, `Erreur lors de la modification du projet #${id}`))
    );
  }

  /**
   * Supprimer un projet
   */
  deleteProject(id: number): Observable<any> {
    const token = localStorage.getItem('token') || localStorage.getItem('jwt');
    
    if (!token) {
      return throwError(() => new Error('Non authentifié'));
    }
    
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    });
    
    console.log(`🗑️ [Manager] DELETE projet #${id}`);
    
    return this.http.delete(`${this.apiUrl}/projects/${id}`, { headers }).pipe(
      tap(() => console.log(`✅ Projet #${id} supprimé`)),
      catchError(error => this.handleError(error, `Erreur lors de la suppression du projet #${id}`))
    );
  }

  // ============================================
  // USERS
  // ============================================

  /**
   * Récupérer tous les utilisateurs
   */
  getUsers(): Observable<ApiResponse<User[]>> {
    const token = localStorage.getItem('token') || localStorage.getItem('jwt');
    
    if (!token) {
      return throwError(() => new Error('Non authentifié'));
    }
    
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    });
    
    const url = `${this.apiUrl}/users?populate=role`;
    console.log('📡 [Manager] GET utilisateurs');
    
    return this.http.get<ApiResponse<User[]>>(url, { headers }).pipe(
      tap(response => console.log(`✅ ${response.data?.length || 0} utilisateurs trouvés`)),
      catchError(error => this.handleError(error, 'Erreur lors du chargement des utilisateurs'))
    );
  }

  /**
   * Récupérer les membres d'une équipe (pour les assignations)
   */
  getTeamMembers(): Observable<ApiResponse<User[]>> {
    // Filtrer pour n'avoir que les membres (pas les managers)
    return this.getUsers().pipe(
      map(response => ({
        ...response,
        data: response.data.filter(user => user.role?.type !== 'MANAGER')
      }))
    );
  }

  // ============================================
  // DASHBOARD STATS
  // ============================================

  /**
   * Récupérer les statistiques du dashboard
   */
  getDashboardStats(): Observable<ApiResponse<DashboardStats>> {
    const headers = this.getHeaders();
    
    // Données mockées
    const mockStats: ApiResponse<DashboardStats> = {
      data: {
        total: 0,
        pending: 0,
        approved: 0,
        rejected: 0,
        cancelled: 0,
        byType: {
          ANNUAL: 0,
          SICK: 0,
          PERSONAL: 0,
          UNPAID: 0,
          MATERNITY: 0,
          OTHER: 0
        },
        totalDaysApproved: 0,
        averageResponseTime: 0
      }
    };
    
    return this.http.get<ApiResponse<DashboardStats>>(`${this.apiUrl}/manager/dashboard-stats`, { headers }).pipe(
      tap(response => console.log('📊 Dashboard stats reçues', response)),
      catchError(error => {
        console.warn('⚠️ Endpoint dashboard stats non disponible, utilisation de données mockées');
        return of(mockStats);
      })
    );
  }

  // ============================================
  // UTILITAIRES
  // ============================================

  /**
   * Récupérer l'utilisateur courant
   */
  getCurrentUser(): User | null {
    return this.currentUser;
  }

  /**
   * Vérifier si l'utilisateur est manager
   */
  isCurrentUserManager(): boolean {
    return this.isManager();
  }

  /**
   * Formater une date pour l'API
   */
  formatDateForApi(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  /**
   * Calculer la durée en jours entre deux dates
   */
  calculateDuration(startDate: string, endDate: string): number {
    const start = new Date(startDate);
    const end = new Date(endDate);
    return Math.ceil((end.getTime() - start.getTime()) / (1000 * 3600 * 24)) + 1;
  }
}