// src/app/services/manager.service.ts
import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, tap, catchError, throwError } from 'rxjs';
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

  // Récupérer toutes les demandes de congé
  getAllLeaveRequests(): Observable<{ data: LeaveRequest[] }> {
    const url = `${this.apiUrl}/leave-requests?sort=createdAt:desc&populate=user`;
    console.log('📡 [Manager] GET toutes les demandes');
    const headers = this.getHeaders();
    return this.http.get<{ data: LeaveRequest[] }>(url, { headers }).pipe(
      tap(response => console.log(`✅ ${response.data?.length || 0} demandes trouvées`)),
      catchError(error => {
        console.error('❌ Erreur chargement:', error);
        return throwError(() => error);
      })
    );
  }

  // Récupérer les demandes de l'utilisateur connecté
  getMyLeaveRequests(): Observable<{ data: LeaveRequest[] }> {
    const url = `${this.apiUrl}/leave-requests?sort=createdAt:desc&populate=user`;
    console.log('📡 [Manager] GET mes demandes');
    const headers = this.getHeaders();
    return this.http.get<{ data: LeaveRequest[] }>(url, { headers }).pipe(
      tap(response => console.log(`✅ ${response.data?.length || 0} demandes personnelles`)),
      catchError(error => {
        console.error('❌ Erreur chargement:', error);
        return throwError(() => error);
      })
    );
  }

  // Créer une demande de congé
  createLeaveRequest(data: any): Observable<any> {
    const token = localStorage.getItem('token') || localStorage.getItem('jwt');
    
    if (!token) {
      return throwError(() => new Error('Non connecté'));
    }
    
    let userId = null;
    const userStr = localStorage.getItem('user');
    if (userStr) {
      try {
        const user = JSON.parse(userStr);
        userId = user.id;
      } catch(e) {}
    }
    
    if (!userId && token) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        userId = payload.id;
      } catch(e) {}
    }
    
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
      catchError(error => throwError(() => error))
    );
  }

  // Modifier une demande de congé
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
      catchError(error => throwError(() => error))
    );
  }

  // Supprimer une demande de congé
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
      catchError(error => throwError(() => error))
    );
  }

  // Approuver une demande
  approveLeaveRequest(id: number, comments?: string): Observable<any> {
    const token = localStorage.getItem('token') || localStorage.getItem('jwt');
    
    if (!token) {
      return throwError(() => new Error('Non connecté'));
    }
    
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    });
    
    const payload = comments ? { comments } : {};
    
    return this.http.post(`${this.apiUrl}/leave-requests/${id}/approve`, payload, { headers }).pipe(
      tap(response => console.log(`✅ Demande ${id} approuvée`)),
      catchError(error => throwError(() => error))
    );
  }

  // Rejeter une demande
  rejectLeaveRequest(id: number, comments?: string): Observable<any> {
    const token = localStorage.getItem('token') || localStorage.getItem('jwt');
    
    if (!token) {
      return throwError(() => new Error('Non connecté'));
    }
    
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    });
    
    const payload = comments ? { comments } : {};
    
    return this.http.post(`${this.apiUrl}/leave-requests/${id}/reject`, payload, { headers }).pipe(
      tap(response => console.log(`❌ Demande ${id} rejetée`)),
      catchError(error => throwError(() => error))
    );
  }

  // Annuler une demande (changer statut à CANCELLED)
  cancelLeaveRequest(id: number): Observable<any> {
    const token = localStorage.getItem('token') || localStorage.getItem('jwt');
    
    if (!token) {
      return throwError(() => new Error('Non connecté'));
    }
    
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    });
    
    // Pour annuler, on met à jour le statut
    const payload = {
      data: {
        statuts: 'CANCELLED'
      }
    };
    
    return this.http.put(`${this.apiUrl}/leave-requests/${id}`, payload, { headers }).pipe(
      tap(response => console.log(`🔄 Demande ${id} annulée`)),
      catchError(error => throwError(() => error))
    );
  }

  // Obtenir les statistiques
  getStats(): Observable<any> {
    const url = `${this.apiUrl}/leave-requests/stats`;
    const headers = this.getHeaders();
    return this.http.get(url, { headers }).pipe(
      tap(response => console.log('📊 Statistiques reçues')),
      catchError(error => throwError(() => error))
    );
  }
}