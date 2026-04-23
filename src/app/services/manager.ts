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

export interface Attendance {
  id: number;
  users_permissions_user: {
    id: number;
    username: string;
    email: string;
    firstName?: string;
    lastName?: string;
  };
  date: string;
  check_in: string | null;
  check_out: string | null;
  statuts: 'PRESENT' | 'ABSENT' | 'LATE' | 'HALF_DAY' | 'HOLIDAY';
  check_in_late_minutes: number;
  early_checkout_minutes: number;
  work_hours: number;
  location?: any;
  ip_address?: string;
  notes?: string;
  publishedAt?: string;
}

export interface AttendanceStats {
  totalDays: number;
  presentDays: number;
  absentDays: number;
  lateDays: number;
  halfDays: number;
  holidayDays: number;
  totalWorkHours: number;
  averageDailyHours: number;
  attendanceRate: number;
  punctualityRate: number;
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
  private useMockData = true; // Mode mocké par défaut pour le développement

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
      console.warn('⚠️ Aucun token trouvé dans le localStorage');
      return new HttpHeaders({ 'Content-Type': 'application/json' });
    }
    
    return new HttpHeaders({
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    });
  }

 private getUserId(): number | null {
  const userStr = localStorage.getItem('user');
  if (!userStr) return null;

  try {
    const user = JSON.parse(userStr);
    return user?.id || null;
  } catch {
    return null;
  }
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
      errorMessage = `Erreur: ${error.error.message}`;
    } else {
      switch (error.status) {
        case 0:
          errorMessage = 'Impossible de se connecter au serveur. Vérifiez que le backend est démarré.';
          break;
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

  getLeaveRequestById(id: number): Observable<ApiResponse<LeaveRequest>> {
    const url = `${this.apiUrl}/leave-requests/${id}?populate=user`;
    console.log(`📡 [Manager] GET demande #${id}`);
    const headers = this.getHeaders();
    
    return this.http.get<ApiResponse<LeaveRequest>>(url, { headers }).pipe(
      tap(response => console.log(`✅ Demande #${id} trouvée`)),
      catchError(error => this.handleError(error, `Erreur lors du chargement de la demande #${id}`))
    );
  }

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

  canEditLeaveRequest(request: LeaveRequest): boolean {
    const isPending = request.statuts === 'PENDING';
    const isManagerOrAdmin = this.isManager();
    return isPending || isManagerOrAdmin;
  }

  getLeaveStats(): Observable<ApiResponse<DashboardStats>> {
    const url = `${this.apiUrl}/leave-requests/stats`;
    const headers = this.getHeaders();
    
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

  getTaskById(id: number): Observable<ApiResponse<Task>> {
    const url = `${this.apiUrl}/tasks/${id}?populate=assigned_to&populate=project`;
    console.log(`📡 [Manager] GET tâche #${id}`);
    const headers = this.getHeaders();
    
    return this.http.get<ApiResponse<Task>>(url, { headers }).pipe(
      tap(response => console.log(`✅ Tâche #${id} trouvée`)),
      catchError(error => this.handleError(error, `Erreur lors du chargement de la tâche #${id}`))
    );
  }

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

  updateTaskStatus(id: number, status: string): Observable<ApiResponse<Task>> {
    return this.updateTask(id, { statuts: status });
  }

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

  getAllProjects(): Observable<ApiResponse<Project[]>> {
    const url = `${this.apiUrl}/projects?sort=createdAt:desc&populate=users&populate=creator`;
    console.log('📡 [Manager] GET tous les projets');
    const headers = this.getHeaders();
    
    return this.http.get<ApiResponse<Project[]>>(url, { headers }).pipe(
      tap(response => console.log(`✅ ${response.data?.length || 0} projets trouvés`)),
      catchError(error => this.handleError(error, 'Erreur lors du chargement des projets'))
    );
  }

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

  getProjectById(id: number): Observable<ApiResponse<Project>> {
    const url = `${this.apiUrl}/projects/${id}?populate=users&populate=creator`;
    console.log(`📡 [Manager] GET projet #${id}`);
    const headers = this.getHeaders();
    
    return this.http.get<ApiResponse<Project>>(url, { headers }).pipe(
      tap(response => console.log(`✅ Projet #${id} trouvé`)),
      catchError(error => this.handleError(error, `Erreur lors du chargement du projet #${id}`))
    );
  }

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

 // ============================================
// USERS
// ============================================

getUsers(): Observable<ApiResponse<User[]>> {
  const headers = this.getHeaders();

  return this.http
    .get<any>(`${this.apiUrl}/users?populate=role`, { headers })
    .pipe(
      map((res: any): ApiResponse<User[]> => {

        const rawUsers: any[] = Array.isArray(res) ? res : res.data ?? [];

        const users: User[] = rawUsers.map((u: any): User => ({
          id: u.id,
          username: u.username,
          email: u.email,
          role: u.role
        }));

        return { data: users };
      }),
      catchError(() => of({ data: [] as User[] }))
    );
}
getTeamMembers(): Observable<ApiResponse<User[]>> {
  return this.getUsers().pipe(
    map((response: ApiResponse<User[]>) => {

      const filtered: User[] = (response.data || []).filter(
        (user: User) => user.role?.type !== 'MANAGER'
      );

      return {
        data: filtered
      };
    })
  );
}
  // ============================================
  // DASHBOARD STATS
  // ============================================

  getDashboardStats(): Observable<ApiResponse<DashboardStats>> {
    const headers = this.getHeaders();
    
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
  // ATTENDANCE - GESTION DES PRÉSENCES
  // ============================================

getAttendances(userId?: number, startDate?: string, endDate?: string) {
  const headers = this.getHeaders();

  let url = `${this.apiUrl}/attendances?sort=date:desc&populate=users_permissions_user`;

  if (userId) {
    url += `&filters[users_permissions_user][id][$eq]=${userId}`;
  }

  if (startDate && endDate) {
    url += `&filters[date][$gte]=${startDate}`;
    url += `&filters[date][$lte]=${endDate}`;
  }

  return this.http.get<any>(url, { headers }).pipe(
    map(res => ({
      data: res.data ?? res,
      meta: res.meta ?? {}
    })),
    catchError(err => this.handleError(err, 'Erreur attendances'))
  );
}

getTodayAttendances() {
  const today = new Date().toISOString().split('T')[0];

  return this.getAttendances(undefined, today, today);
}

 getAttendanceStats(
  userId: number,
  month: string
): Observable<ApiResponse<AttendanceStats>> {

  const [yearStr, monthStr] = month.split('-');

  const year = Number(yearStr);
  const monthNum = Number(monthStr);

  // premier jour du mois
  const startDate: string = `${year}-${String(monthNum).padStart(2, '0')}-01`;

  // dernier jour du mois
  const endDate: string = new Date(year, monthNum, 0)
    .toISOString()
    .split('T')[0];

  return this.getAttendances(userId, startDate, endDate).pipe(
    map((res: ApiResponse<Attendance[]>) => {

      const data: Attendance[] = res.data ?? [];

      const presentDays = data.filter(
        (a: Attendance) => a.statuts === 'PRESENT'
      ).length;

      const absentDays = data.filter(
        (a: Attendance) => a.statuts === 'ABSENT'
      ).length;

      const lateDays = data.filter(
        (a: Attendance) => a.statuts === 'LATE'
      ).length;

      const halfDays = data.filter(
        (a: Attendance) => a.statuts === 'HALF_DAY'
      ).length;

      const holidayDays = data.filter(
        (a: Attendance) => a.statuts === 'HOLIDAY'
      ).length;

      const totalWorkHours = data.reduce(
        (sum: number, a: Attendance) => sum + (a.work_hours ?? 0),
        0
      );

      const totalDays = data.length;

      const stats: AttendanceStats = {
        totalDays,
        presentDays,
        absentDays,
        lateDays,
        halfDays,
        holidayDays,
        totalWorkHours,

        averageDailyHours:
          totalDays > 0 ? totalWorkHours / totalDays : 0,

        attendanceRate:
          totalDays > 0
            ? ((presentDays + halfDays) / totalDays) * 100
            : 0,

        punctualityRate:
          presentDays > 0
            ? data.filter(
                (a: Attendance) => a.check_in_late_minutes === 0
              ).length / presentDays * 100
            : 0
      };

      return { data: stats };
    })
  );
}

  exportAttendanceToPDF(userId: number, month: string) {
  const headers = this.getHeaders();

  const url = `${this.apiUrl}/attendances/export-pdf?userId=${userId}&month=${month}`;

  return this.http.get(url, {
    headers,
    responseType: 'blob'
  });
}

  // ============================================
  // UTILITAIRES
  // ============================================

  getCurrentUser(): User | null {
    return this.currentUser;
  }

  isCurrentUserManager(): boolean {
    return this.isManager();
  }

  // Ajoutez cette méthode dans votre ManagerService

private formatDateForApi(date: string | Date): string {
  if (!date) return '';
  
  let dateObj: Date;
  if (typeof date === 'string') {
    dateObj = new Date(date);
  } else {
    dateObj = date;
  }
  
  // Vérifier si la date est valide
  if (isNaN(dateObj.getTime())) {
    console.warn('⚠️ Date invalide:', date);
    return '';
  }
  
  // Formater en YYYY-MM-DD
  const year = dateObj.getFullYear();
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const day = String(dateObj.getDate()).padStart(2, '0');
  
  return `${year}-${month}-${day}`;
}

  calculateDuration(startDate: string, endDate: string): number {
    const start = new Date(startDate);
    const end = new Date(endDate);
    return Math.ceil((end.getTime() - start.getTime()) / (1000 * 3600 * 24)) + 1;
  }

  // ============================================
  // MODE MOCKÉ
  // ============================================

  setMockMode(useMock: boolean): void {
    this.useMockData = useMock;
  }

  isMockMode(): boolean {
    return this.useMockData;
  }
}