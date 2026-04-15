// src/app/services/manager.service.ts
import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpErrorResponse } from '@angular/common/http';
import { Observable, tap, catchError, throwError, of } from 'rxjs';
import { environment } from '../../environments/environment';

export interface LeaveRequest {
  id: number;
  type: string;
  start_date: string;
  end_date: string;
  duration_days: number;
  reason: string;
  statuts: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
  user?: {
    id: number;
    username: string;
    email: string;
  };
  manager_comments?: string;
  approval_date?: string;
  created_at?: string;
}

export interface Task {
  id: number;
  title: string;
  description: string;
  statuts: 'TODO' | 'IN_PROGRESS' | 'DONE';
  priority: 'LOW' | 'MEDIUM' | 'HIGH';
  due_date: string;
  assigned_to?: {
    id: number;
    username: string;
    email: string;
  };
  project?: {
    id: number;
    name: string;
  };
  created_at?: string;
}

export interface Project {
  id: number;
  name: string;
  description: string;
  statuts: 'PLANNED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  start_date: string;
  end_date: string;
  users?: Array<{
    id: number;
    username: string;
    email: string;
  }>;
  creator?: {
    id: number;
    username: string;
    email: string;
  };
  created_at?: string;
}

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

@Injectable({
  providedIn: 'root'
})
export class ManagerService {
  private apiUrl = environment.apiUrl || 'http://localhost:1337/api';

  constructor(private http: HttpClient) {}

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
    let userId = null;
    const userStr = localStorage.getItem('user');
    if (userStr) {
      try {
        const user = JSON.parse(userStr);
        userId = user.id;
      } catch(e) {}
    }
    
    if (!userId) {
      const token = localStorage.getItem('token') || localStorage.getItem('jwt');
      if (token) {
        try {
          const payload = JSON.parse(atob(token.split('.')[1]));
          userId = payload.id;
        } catch(e) {}
      }
    }
    
    return userId;
  }

  // =========================
  // LEAVE REQUESTS
  // =========================

  getAllLeaveRequests(): Observable<{ data: LeaveRequest[] }> {
    const url = `${this.apiUrl}/leave-requests?sort=createdAt:desc&populate=user`;
    console.log('📡 [Manager] GET toutes les demandes');
    const headers = this.getHeaders();
    return this.http.get<{ data: LeaveRequest[] }>(url, { headers }).pipe(
      tap(response => console.log(`✅ ${response.data?.length || 0} demandes trouvées`)),
      catchError((error: HttpErrorResponse) => {
        console.error('❌ Erreur chargement:', error);
        return throwError(() => error);
      })
    );
  }

  getMyLeaveRequests(): Observable<{ data: LeaveRequest[] }> {
    const userId = this.getUserId();
    const url = `${this.apiUrl}/leave-requests?sort=createdAt:desc&populate=user&filters[user][id][$eq]=${userId}`;
    console.log('📡 [Manager] GET mes demandes');
    const headers = this.getHeaders();
    return this.http.get<{ data: LeaveRequest[] }>(url, { headers }).pipe(
      tap(response => console.log(`✅ ${response.data?.length || 0} demandes personnelles`)),
      catchError((error: HttpErrorResponse) => {
        console.error('❌ Erreur chargement:', error);
        return throwError(() => error);
      })
    );
  }

  createLeaveRequest(data: any): Observable<any> {
    const token = localStorage.getItem('token') || localStorage.getItem('jwt');
    
    if (!token) {
      return throwError(() => new Error('Non connecté'));
    }
    
    const userId = this.getUserId();
    if (!userId) {
      return throwError(() => new Error('Utilisateur non connecté'));
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
        reason: data.reason,
        userId: userId
      }
    };

    return this.http.post(`${this.apiUrl}/leave-requests`, payload, { headers }).pipe(
      tap(response => console.log('✅ Demande créée')),
      catchError((error: HttpErrorResponse) => throwError(() => error))
    );
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
      tap(response => console.log('✅ Demande modifiée')),
      catchError((error: HttpErrorResponse) => throwError(() => error))
    );
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
    
    return this.http.delete(`${this.apiUrl}/leave-requests/${id}`, { headers }).pipe(
      tap(response => console.log(`✅ Demande ${id} supprimée`)),
      catchError((error: HttpErrorResponse) => throwError(() => error))
    );
  }

  approveLeaveRequest(id: number, comments?: string): Observable<any> {
    const token = localStorage.getItem('token') || localStorage.getItem('jwt');
    
    if (!token) {
      return throwError(() => new Error('Non connecté'));
    }
    
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    });
    
    return this.http.post(`${this.apiUrl}/leave-requests/${id}/approve`, { comments }, { headers }).pipe(
      tap(response => console.log(`✅ Demande ${id} approuvée`)),
      catchError((error: HttpErrorResponse) => throwError(() => error))
    );
  }

  rejectLeaveRequest(id: number, comments?: string): Observable<any> {
    const token = localStorage.getItem('token') || localStorage.getItem('jwt');
    
    if (!token) {
      return throwError(() => new Error('Non connecté'));
    }
    
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    });
    
    return this.http.post(`${this.apiUrl}/leave-requests/${id}/reject`, { comments }, { headers }).pipe(
      tap(response => console.log(`❌ Demande ${id} rejetée`)),
      catchError((error: HttpErrorResponse) => throwError(() => error))
    );
  }

  cancelLeaveRequest(id: number): Observable<any> {
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
        statuts: 'CANCELLED'
      }
    };
    
    return this.http.put(`${this.apiUrl}/leave-requests/${id}`, payload, { headers }).pipe(
      tap(response => console.log(`🔄 Demande ${id} annulée`)),
      catchError((error: HttpErrorResponse) => throwError(() => error))
    );
  }

  // 🔥 CORRECTION: getLeaveStats avec gestion d'erreur et données mockées
  getLeaveStats(): Observable<any> {
    const url = `${this.apiUrl}/leave-requests/stats`;
    const headers = this.getHeaders();
    
    // Données mockées par défaut
    const mockStats = {
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
        totalDaysApproved: 0
      }
    };
    
    return this.http.get(url, { headers }).pipe(
      tap(response => console.log('📊 Statistiques congés reçues', response)),
      catchError((error: HttpErrorResponse) => {
        console.warn('⚠️ Endpoint stats non disponible (404), utilisation de données mockées');
        // Retourner des données mockées au lieu de l'erreur
        return of(mockStats);
      })
    );
  }

  // =========================
  // TASKS
  // =========================

  getAllTasks(): Observable<{ data: Task[] }> {
    const url = `${this.apiUrl}/tasks?sort=due_date:asc&populate=assigned_to&populate=project`;
    console.log('📡 [Manager] GET toutes les tâches');
    const headers = this.getHeaders();
    return this.http.get<{ data: Task[] }>(url, { headers }).pipe(
      tap(response => console.log(`✅ ${response.data?.length || 0} tâches trouvées`)),
      catchError((error: HttpErrorResponse) => {
        console.error('❌ Erreur chargement tâches:', error);
        return throwError(() => error);
      })
    );
  }

  getMyTasks(): Observable<{ data: Task[] }> {
    const userId = this.getUserId();
    const url = `${this.apiUrl}/tasks?sort=due_date:asc&populate=assigned_to&populate=project&filters[assigned_to][id][$eq]=${userId}`;
    console.log('📡 [Manager] GET mes tâches');
    const headers = this.getHeaders();
    return this.http.get<{ data: Task[] }>(url, { headers }).pipe(
      tap(response => console.log(`✅ ${response.data?.length || 0} tâches personnelles`)),
      catchError((error: HttpErrorResponse) => {
        console.error('❌ Erreur chargement tâches:', error);
        return throwError(() => error);
      })
    );
  }

  createTask(data: any): Observable<any> {
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
        title: data.title,
        description: data.description,
        priority: data.priority,
        due_date: data.due_date,
        assigned_to: data.assigned_to,
        project: data.project
      }
    };

    return this.http.post(`${this.apiUrl}/tasks`, payload, { headers }).pipe(
      tap(response => console.log('✅ Tâche créée')),
      catchError((error: HttpErrorResponse) => throwError(() => error))
    );
  }

  updateTask(id: number, data: any): Observable<any> {
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
        title: data.title,
        description: data.description,
        priority: data.priority,
        statuts: data.statuts,
        due_date: data.due_date,
        assigned_to: data.assigned_to,
        project: data.project
      }
    };
    
    return this.http.put(`${this.apiUrl}/tasks/${id}`, payload, { headers }).pipe(
      tap(response => console.log('✅ Tâche modifiée')),
      catchError((error: HttpErrorResponse) => throwError(() => error))
    );
  }

  updateTaskStatus(id: number, status: string): Observable<any> {
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
        statuts: status
      }
    };
    
    return this.http.put(`${this.apiUrl}/tasks/${id}`, payload, { headers }).pipe(
      tap(response => console.log(`✅ Statut tâche ${id} mis à jour: ${status}`)),
      catchError((error: HttpErrorResponse) => throwError(() => error))
    );
  }

  deleteTask(id: number): Observable<any> {
    const token = localStorage.getItem('token') || localStorage.getItem('jwt');
    
    if (!token) {
      return throwError(() => new Error('Non connecté'));
    }
    
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    });
    
    return this.http.delete(`${this.apiUrl}/tasks/${id}`, { headers }).pipe(
      tap(response => console.log(`✅ Tâche ${id} supprimée`)),
      catchError((error: HttpErrorResponse) => throwError(() => error))
    );
  }

  // =========================
  // PROJECTS
  // =========================

  getAllProjects(): Observable<{ data: Project[] }> {
    const url = `${this.apiUrl}/projects?sort=createdAt:desc&populate=users&populate=creator`;
    console.log('📡 [Manager] GET tous les projets');
    const headers = this.getHeaders();
    return this.http.get<{ data: Project[] }>(url, { headers }).pipe(
      tap(response => console.log(`✅ ${response.data?.length || 0} projets trouvés`)),
      catchError((error: HttpErrorResponse) => {
        console.error('❌ Erreur chargement projets:', error);
        return throwError(() => error);
      })
    );
  }

  getMyProjects(): Observable<{ data: Project[] }> {
    const userId = this.getUserId();
    const url = `${this.apiUrl}/projects?sort=createdAt:desc&populate=users&populate=creator&filters[users][id][$eq]=${userId}`;
    console.log('📡 [Manager] GET mes projets');
    const headers = this.getHeaders();
    return this.http.get<{ data: Project[] }>(url, { headers }).pipe(
      tap(response => console.log(`✅ ${response.data?.length || 0} projets personnels`)),
      catchError((error: HttpErrorResponse) => {
        console.error('❌ Erreur chargement projets:', error);
        return throwError(() => error);
      })
    );
  }

  createProject(data: any): Observable<any> {
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
        name: data.name,
        description: data.description,
        statuts: data.statuts || 'PLANNED',
        start_date: data.start_date,
        end_date: data.end_date,
        users: data.users
      }
    };

    return this.http.post(`${this.apiUrl}/projects`, payload, { headers }).pipe(
      tap(response => console.log('✅ Projet créé')),
      catchError((error: HttpErrorResponse) => throwError(() => error))
    );
  }

  updateProject(id: number, data: any): Observable<any> {
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
        name: data.name,
        description: data.description,
        statuts: data.statuts,
        start_date: data.start_date,
        end_date: data.end_date,
        users: data.users
      }
    };
    
    return this.http.put(`${this.apiUrl}/projects/${id}`, payload, { headers }).pipe(
      tap(response => console.log('✅ Projet modifié')),
      catchError((error: HttpErrorResponse) => throwError(() => error))
    );
  }

  deleteProject(id: number): Observable<any> {
    const token = localStorage.getItem('token') || localStorage.getItem('jwt');
    
    if (!token) {
      return throwError(() => new Error('Non connecté'));
    }
    
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    });
    
    return this.http.delete(`${this.apiUrl}/projects/${id}`, { headers }).pipe(
      tap(response => console.log(`✅ Projet ${id} supprimé`)),
      catchError((error: HttpErrorResponse) => throwError(() => error))
    );
  }

  // =========================
  // USERS
  // =========================

  getUsers(): Observable<{ data: User[] }> {
    const token = localStorage.getItem('token') || localStorage.getItem('jwt');
    
    if (!token) {
      return throwError(() => new Error('Non connecté'));
    }
    
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    });
    
    const url = `${this.apiUrl}/users?populate=role`;
    console.log('📡 [Manager] GET utilisateurs');
    return this.http.get<{ data: User[] }>(url, { headers }).pipe(
      tap(response => console.log(`✅ ${response.data?.length || 0} utilisateurs trouvés`)),
      catchError((error: HttpErrorResponse) => throwError(() => error))
    );
  }

  // =========================
  // DASHBOARD STATS
  // =========================

  getDashboardStats(): Observable<any> {
    const headers = this.getHeaders();
    return this.http.get(`${this.apiUrl}/manager/dashboard-stats`, { headers }).pipe(
      tap(response => console.log('📊 Dashboard stats reçues')),
      catchError((error: HttpErrorResponse) => throwError(() => error))
    );
  }
}