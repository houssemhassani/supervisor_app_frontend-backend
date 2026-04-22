import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatCardModule } from '@angular/material/card';
import { MatTooltipModule } from '@angular/material/tooltip';

import { ManagerService, LeaveRequest, DashboardStats, ApiResponse } from '../../../services/manager';
import { LeaveRequestFormComponent } from '../leave-request-form/leave-request-form';
import { ConfirmationDialogComponent } from '../confirmation-dialog/confirmation-dialog';
import { LeaveRequestListComponent } from '../leave-request-list/leave-request-list';
import { AttendanceManagementComponent } from '../attendancemanagement/attendancemanagement';

import { Subscription, forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { HttpErrorResponse } from '@angular/common/http';

// ============================================
// INTERFACES LOCALES
// ============================================

interface DashboardUIState {
  isLoading: boolean;
  isRefreshing: boolean;
  activeTab: 'leave' | 'attendance' | 'tasks' | 'projects';
  leaveSubTab: 'myRequests' | 'allRequests';
  useMockData: boolean;
  errorMessage: string | null;
}

// ============================================
// DONNÉES MOCKÉES POUR LE DÉVELOPPEMENT
// ============================================

const MOCK_USERS = [
  { id: 1, username: 'Jean Dupont', email: 'jean.dupont@entreprise.com', firstName: 'Jean', lastName: 'Dupont' },
  { id: 2, username: 'Marie Martin', email: 'marie.martin@entreprise.com', firstName: 'Marie', lastName: 'Martin' },
  { id: 3, username: 'Pierre Durand', email: 'pierre.durand@entreprise.com', firstName: 'Pierre', lastName: 'Durand' },
  { id: 4, username: 'Sophie Bernard', email: 'sophie.bernard@entreprise.com', firstName: 'Sophie', lastName: 'Bernard' },
  { id: 5, username: 'Julie Petit', email: 'julie.petit@entreprise.com', firstName: 'Julie', lastName: 'Petit' },
  { id: 6, username: 'Thomas Robert', email: 'thomas.robert@entreprise.com', firstName: 'Thomas', lastName: 'Robert' },
];

const MOCK_LEAVE_REQUESTS: LeaveRequest[] = [
  {
    id: 1,
    type: 'ANNUAL',
    start_date: '2026-04-01',
    end_date: '2026-04-10',
    duration_days: 10,
    reason: 'Vacances de printemps - Voyage en famille',
    statuts: 'PENDING',
    user: MOCK_USERS[0],
    created_at: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
    manager_comments: undefined
  },
  {
    id: 2,
    type: 'SICK',
    start_date: '2026-04-05',
    end_date: '2026-04-07',
    duration_days: 3,
    reason: 'Arrêt maladie - Grippe',
    statuts: 'APPROVED',
    user: MOCK_USERS[1],
    created_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
    approval_date: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString(),
    manager_comments: 'Bon rétablissement'
  },
  {
    id: 3,
    type: 'PERSONAL',
    start_date: '2026-04-15',
    end_date: '2026-04-16',
    duration_days: 2,
    reason: 'Rendez-vous médical important',
    statuts: 'PENDING',
    user: MOCK_USERS[2],
    created_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    manager_comments: undefined
  },
  {
    id: 4,
    type: 'UNPAID',
    start_date: '2026-04-20',
    end_date: '2026-04-22',
    duration_days: 3,
    reason: 'Congé sans solde pour affaires personnelles',
    statuts: 'REJECTED',
    user: MOCK_USERS[3],
    created_at: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString(),
    rejection_date: new Date(Date.now() - 18 * 24 * 60 * 60 * 1000).toISOString(),
    manager_comments: 'Période trop chargée, à reporter'
  },
  {
    id: 5,
    type: 'MATERNITY',
    start_date: '2026-05-01',
    end_date: '2026-07-01',
    duration_days: 62,
    reason: 'Congé maternité',
    statuts: 'APPROVED',
    user: MOCK_USERS[4],
    created_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    approval_date: new Date(Date.now() - 28 * 24 * 60 * 60 * 1000).toISOString(),
    manager_comments: 'Félicitations !'
  },
  {
    id: 6,
    type: 'ANNUAL',
    start_date: '2026-06-10',
    end_date: '2026-06-20',
    duration_days: 11,
    reason: 'Vacances d\'été',
    statuts: 'PENDING',
    user: MOCK_USERS[5],
    created_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    manager_comments: undefined
  },
  {
    id: 7,
    type: 'SICK',
    start_date: '2026-04-08',
    end_date: '2026-04-09',
    duration_days: 2,
    reason: 'Maladie enfant',
    statuts: 'APPROVED',
    user: MOCK_USERS[0],
    created_at: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000).toISOString(),
    approval_date: new Date(Date.now() - 11 * 24 * 60 * 60 * 1000).toISOString(),
    manager_comments: 'Bon courage'
  },
  {
    id: 8,
    type: 'PERSONAL',
    start_date: '2026-04-25',
    end_date: '2026-04-25',
    duration_days: 1,
    reason: 'Déménagement',
    statuts: 'PENDING',
    user: MOCK_USERS[1],
    created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    manager_comments: undefined
  }
];

// ============================================
// COMPOSANT PRINCIPAL
// ============================================

@Component({
  selector: 'app-manager-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    MatCardModule,
    MatTooltipModule,
    LeaveRequestListComponent,
    AttendanceManagementComponent
  ],
  templateUrl: './manager-dashboard.html',
  styleUrls: ['./manager-dashboard.scss']
})
export class ManagerDashboardComponent implements OnInit, OnDestroy {
  
  // ============================================
  // DONNÉES
  // ============================================
  
  myLeaveRequests: LeaveRequest[] = [];
  allLeaveRequests: LeaveRequest[] = [];
  stats: DashboardStats | null = null;
  
  // État de l'interface
  uiState: DashboardUIState = {
    isLoading: true,
    isRefreshing: false,
    activeTab: 'leave',
    leaveSubTab: 'myRequests',
    useMockData: true,
    errorMessage: null
  };
  
  // Abonnements
  private subscriptions = new Subscription();
  private refreshDebounce: any;
  
  // ============================================
  // CONSTRUCTEUR
  // ============================================
  
  constructor(
    private managerService: ManagerService,
    private dialog: MatDialog,
    private snackBar: MatSnackBar,
    private cdr: ChangeDetectorRef
  ) {}
  
  // ============================================
  // CYCLE DE VIE
  // ============================================
  
  ngOnInit(): void {
    this.loadAllData();
  }
  
  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
    if (this.refreshDebounce) {
      clearTimeout(this.refreshDebounce);
    }
  }
  
  // ============================================
  // CHARGEMENT DES DONNÉES
  // ============================================
  
  private loadAllData(): void {
    this.uiState.isLoading = true;
    this.uiState.errorMessage = null;
    
    if (this.uiState.useMockData) {
      this.loadMockData();
    } else {
      this.loadRealData();
    }
  }
  
  private loadMockData(): void {
    setTimeout(() => {
      try {
        const currentUserId = 1;
        this.myLeaveRequests = MOCK_LEAVE_REQUESTS.filter(r => r.user?.id === currentUserId);
        this.allLeaveRequests = [...MOCK_LEAVE_REQUESTS];
        this.stats = this.calculateStatsFromRequests(this.allLeaveRequests);
        
        this.uiState.isLoading = false;
        this.cdr.detectChanges();
        
        console.log('✅ Données mockées chargées');
      } catch (error) {
        console.error('❌ Erreur chargement mock data:', error);
        this.uiState.errorMessage = 'Erreur lors du chargement des données';
        this.uiState.isLoading = false;
        this.cdr.detectChanges();
      }
    }, 500);
  }
  
  private loadRealData(): void {
    // Vérifier si l'utilisateur est connecté
    const token = localStorage.getItem('token') || localStorage.getItem('jwt');
    if (!token) {
      console.warn('⚠️ Aucun token trouvé, utilisation du mode mocké');
      this.uiState.useMockData = true;
      this.loadMockData();
      return;
    }
    
    const allLeaveRequests$ = this.managerService.getAllLeaveRequests().pipe(
      catchError((error: HttpErrorResponse) => {
        console.error('Erreur chargement all leave requests:', error);
        if (error.status === 401) {
          this.showNotification('⚠️ Session expirée, veuillez vous reconnecter', 'warning');
          this.uiState.useMockData = true;
          this.loadMockData();
        }
        return of({ data: [] } as ApiResponse<LeaveRequest[]>);
      })
    );
    
    const myLeaveRequests$ = this.managerService.getMyLeaveRequests().pipe(
      catchError((error: HttpErrorResponse) => {
        console.error('Erreur chargement my leave requests:', error);
        return of({ data: [] } as ApiResponse<LeaveRequest[]>);
      })
    );
    
    const stats$ = this.managerService.getLeaveStats().pipe(
      catchError((error: HttpErrorResponse) => {
        console.error('Erreur chargement stats:', error);
        return of({ data: null as unknown as DashboardStats });
      })
    );
    
    const sub = forkJoin([allLeaveRequests$, myLeaveRequests$, stats$]).subscribe({
      next: ([allLeaveRes, myLeaveRes, statsRes]) => {
        this.allLeaveRequests = allLeaveRes.data || [];
        this.myLeaveRequests = myLeaveRes.data || [];
        this.stats = statsRes.data || this.calculateStatsFromRequests(this.allLeaveRequests);
        
        this.uiState.isLoading = false;
        this.cdr.detectChanges();
        
        const totalRequests = this.allLeaveRequests.length;
        if (totalRequests > 0) {
          this.showNotification(`✅ ${totalRequests} demande(s) chargée(s)`, 'success');
        } else {
          this.showNotification('✅ Données chargées (aucune demande)', 'info');
        }
      },
      error: (error: HttpErrorResponse) => {
        console.error('Erreur générale:', error);
        this.stats = this.getEmptyStats();
        this.uiState.isLoading = false;
        this.uiState.errorMessage = 'Erreur lors du chargement des données';
        this.cdr.detectChanges();
        this.showNotification('❌ Erreur lors du chargement des données', 'error');
      }
    });
    
    this.subscriptions.add(sub);
  }
  
  // ============================================
  // CALCUL DES STATISTIQUES
  // ============================================
  
  private calculateStatsFromRequests(requests: LeaveRequest[]): DashboardStats {
    const total = requests.length;
    const pending = requests.filter(r => r.statuts === 'PENDING').length;
    const approvedRequests = requests.filter(r => r.statuts === 'APPROVED');
    const approved = approvedRequests.length;
    const rejected = requests.filter(r => r.statuts === 'REJECTED').length;
    const cancelled = requests.filter(r => r.statuts === 'CANCELLED').length;
    
    let totalDaysApproved = 0;
    for (const request of approvedRequests) {
      totalDaysApproved += request.duration_days;
    }
    
    let averageResponseTime = 0;
    const respondedRequests = requests.filter(r => r.approval_date || r.rejection_date);
    if (respondedRequests.length > 0) {
      let totalResponseDays = 0;
      for (const request of respondedRequests) {
        const createdDate = new Date(request.created_at || 0);
        const responseDate = new Date(request.approval_date || request.rejection_date || 0);
        const daysDiff = (responseDate.getTime() - createdDate.getTime()) / (1000 * 3600 * 24);
        totalResponseDays += daysDiff;
      }
      averageResponseTime = totalResponseDays / respondedRequests.length;
    }
    
    return {
      total,
      pending,
      approved,
      rejected,
      cancelled,
      byType: {
        ANNUAL: requests.filter(r => r.type === 'ANNUAL').length,
        SICK: requests.filter(r => r.type === 'SICK').length,
        PERSONAL: requests.filter(r => r.type === 'PERSONAL').length,
        UNPAID: requests.filter(r => r.type === 'UNPAID').length,
        MATERNITY: requests.filter(r => r.type === 'MATERNITY').length,
        OTHER: requests.filter(r => r.type === 'OTHER').length
      },
      totalDaysApproved,
      averageResponseTime
    };
  }
  
  private getEmptyStats(): DashboardStats {
    return {
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
    };
  }
  
  // ============================================
  // ACTIONS - ONGLETS
  // ============================================
  
  setActiveTab(tab: 'leave' | 'attendance' | 'tasks' | 'projects'): void {
    this.uiState.activeTab = tab;
  }
  
  switchLeaveSubTab(tab: 'myRequests' | 'allRequests'): void {
    this.uiState.leaveSubTab = tab;
  }
  
  // ============================================
  // ACTIONS - DEMANDES DE CONGÉ
  // ============================================
  
  openCreateLeaveDialog(): void {
    const dialogRef = this.dialog.open(LeaveRequestFormComponent, {
      width: '600px',
      data: { 
        isReadOnly: false,
        mode: 'create'
      }
    });
    
    const sub = dialogRef.afterClosed().subscribe((result: any) => {
      if (!result) return;
      
      if (this.uiState.useMockData) {
        this.createMockLeaveRequest(result);
      } else {
        this.createRealLeaveRequest(result);
      }
    });
    
    this.subscriptions.add(sub);
  }
  
  private createMockLeaveRequest(data: any): void {
    const currentUser = MOCK_USERS[0];
    const newRequest: LeaveRequest = {
      id: Date.now(),
      type: data.type,
      start_date: data.start_date,
      end_date: data.end_date,
      duration_days: data.duration_days,
      reason: data.reason,
      statuts: 'PENDING',
      user: currentUser,
      created_at: new Date().toISOString(),
      manager_comments: undefined
    };
    
    this.allLeaveRequests = [newRequest, ...this.allLeaveRequests];
    this.myLeaveRequests = [newRequest, ...this.myLeaveRequests];
    this.stats = this.calculateStatsFromRequests(this.allLeaveRequests);
    
    this.showNotification('✅ Demande créée avec succès', 'success');
    this.cdr.detectChanges();
  }
  
  private createRealLeaveRequest(data: any): void {
    this.uiState.isLoading = true;
    
    this.managerService.createLeaveRequest(data).subscribe({
      next: () => {
        this.uiState.isLoading = false;
        this.showNotification('✅ Demande de congé créée avec succès', 'success');
        this.refreshData();
      },
      error: (error: Error) => {
        this.uiState.isLoading = false;
        console.error('Erreur création:', error);
        this.showNotification(`❌ Erreur: ${error.message}`, 'error');
        this.cdr.detectChanges();
      }
    });
  }
  
  openEditLeaveDialog(request: LeaveRequest): void {
    if (!this.canEditLeaveRequest(request)) {
      this.showNotification('⚠️ Cette demande ne peut plus être modifiée car elle a déjà été traitée', 'warning');
      return;
    }
    
    if (!this.uiState.useMockData) {
      this.uiState.isLoading = true;
      this.managerService.getLeaveRequestById(request.id).subscribe({
        next: (response) => {
          this.uiState.isLoading = false;
          this.openEditDialogWithData(response.data);
        },
        error: (error) => {
          this.uiState.isLoading = false;
          console.error('Erreur chargement demande:', error);
          this.openEditDialogWithData(request);
        }
      });
    } else {
      this.openEditDialogWithData(request);
    }
  }
  
  private openEditDialogWithData(request: LeaveRequest): void {
    const dialogRef = this.dialog.open(LeaveRequestFormComponent, {
      width: '600px',
      data: { 
        leaveRequest: request, 
        isReadOnly: false,
        mode: 'edit'
      }
    });
    
    const sub = dialogRef.afterClosed().subscribe((result: any) => {
      if (!result) return;
      
      if (this.uiState.useMockData) {
        this.updateMockLeaveRequest(request.id, result);
      } else {
        this.updateRealLeaveRequest(request.id, result);
      }
    });
    
    this.subscriptions.add(sub);
  }
  
  private updateMockLeaveRequest(id: number, data: any): void {
    const index = this.allLeaveRequests.findIndex(r => r.id === id);
    if (index !== -1) {
      const updatedRequest: LeaveRequest = { 
        ...this.allLeaveRequests[index], 
        type: data.type,
        start_date: data.start_date,
        end_date: data.end_date,
        duration_days: data.duration_days,
        reason: data.reason,
        updated_at: new Date().toISOString()
      };
      this.allLeaveRequests[index] = updatedRequest;
      
      const myIndex = this.myLeaveRequests.findIndex(r => r.id === id);
      if (myIndex !== -1) {
        this.myLeaveRequests[myIndex] = updatedRequest;
      }
      
      this.stats = this.calculateStatsFromRequests(this.allLeaveRequests);
      this.showNotification('✅ Demande modifiée avec succès', 'success');
      this.cdr.detectChanges();
    }
  }
  
  private updateRealLeaveRequest(id: number, data: any): void {
    this.uiState.isLoading = true;
    
    this.managerService.updateLeaveRequest(id, data).subscribe({
      next: () => {
        this.uiState.isLoading = false;
        this.showNotification('✅ Demande modifiée avec succès', 'success');
        this.refreshData();
      },
      error: (error: Error) => {
        this.uiState.isLoading = false;
        console.error('Erreur modification:', error);
        this.showNotification(`❌ Erreur: ${error.message}`, 'error');
        this.cdr.detectChanges();
      }
    });
  }
  
  deleteLeaveRequest(request: LeaveRequest): void {
    const dialogRef = this.dialog.open(ConfirmationDialogComponent, {
      width: '400px',
      data: { 
        title: 'Supprimer la demande', 
        message: `Êtes-vous sûr de vouloir supprimer définitivement cette demande de congé ?`,
        type: 'danger'
      }
    });
    
    const sub = dialogRef.afterClosed().subscribe((confirm: boolean) => {
      if (!confirm) return;
      
      if (this.uiState.useMockData) {
        this.deleteMockLeaveRequest(request.id);
      } else {
        this.deleteRealLeaveRequest(request.id);
      }
    });
    
    this.subscriptions.add(sub);
  }
  
  private deleteMockLeaveRequest(id: number): void {
    this.allLeaveRequests = this.allLeaveRequests.filter(r => r.id !== id);
    this.myLeaveRequests = this.myLeaveRequests.filter(r => r.id !== id);
    this.stats = this.calculateStatsFromRequests(this.allLeaveRequests);
    
    this.showNotification('🗑️ Demande supprimée avec succès', 'success');
    this.cdr.detectChanges();
  }
  
  private deleteRealLeaveRequest(id: number): void {
    this.uiState.isLoading = true;
    
    this.managerService.deleteLeaveRequest(id).subscribe({
      next: () => {
        this.uiState.isLoading = false;
        this.showNotification('🗑️ Demande supprimée avec succès', 'success');
        this.refreshData();
      },
      error: (error: Error) => {
        this.uiState.isLoading = false;
        console.error('Erreur suppression:', error);
        this.showNotification(`❌ Erreur: ${error.message}`, 'error');
        this.cdr.detectChanges();
      }
    });
  }
  
  approveLeaveRequest(request: LeaveRequest): void {
    const dialogRef = this.dialog.open(ConfirmationDialogComponent, {
      width: '400px',
      data: { 
        title: 'Approuver la demande', 
        message: `Confirmez-vous l'approbation de la demande de ${request.user?.username || 'congé'} ?`,
        type: 'success'
      }
    });
    
    const sub = dialogRef.afterClosed().subscribe((confirm: boolean) => {
      if (!confirm) return;
      
      if (this.uiState.useMockData) {
        this.approveMockLeaveRequest(request.id);
      } else {
        this.approveRealLeaveRequest(request.id);
      }
    });
    
    this.subscriptions.add(sub);
  }
  
  private approveMockLeaveRequest(id: number): void {
    const index = this.allLeaveRequests.findIndex(r => r.id === id);
    if (index !== -1) {
      const updatedRequest: LeaveRequest = { 
        ...this.allLeaveRequests[index], 
        statuts: 'APPROVED',
        approval_date: new Date().toISOString()
      };
      this.allLeaveRequests[index] = updatedRequest;
      this.stats = this.calculateStatsFromRequests(this.allLeaveRequests);
      this.showNotification('✅ Demande approuvée avec succès', 'success');
      this.cdr.detectChanges();
    }
  }
  
  private approveRealLeaveRequest(id: number): void {
    this.uiState.isLoading = true;
    
    this.managerService.approveLeaveRequest(id).subscribe({
      next: () => {
        this.uiState.isLoading = false;
        this.showNotification('✅ Demande approuvée avec succès', 'success');
        this.refreshData();
      },
      error: (error: Error) => {
        this.uiState.isLoading = false;
        console.error('Erreur approbation:', error);
        this.showNotification(`❌ Erreur: ${error.message}`, 'error');
        this.cdr.detectChanges();
      }
    });
  }
  
  rejectLeaveRequest(request: LeaveRequest): void {
    const dialogRef = this.dialog.open(ConfirmationDialogComponent, {
      width: '400px',
      data: { 
        title: 'Rejeter la demande', 
        message: `Confirmez-vous le rejet de la demande de ${request.user?.username || 'congé'} ?`,
        type: 'warning'
      }
    });
    
    const sub = dialogRef.afterClosed().subscribe((confirm: boolean) => {
      if (!confirm) return;
      
      if (this.uiState.useMockData) {
        this.rejectMockLeaveRequest(request.id);
      } else {
        this.rejectRealLeaveRequest(request.id);
      }
    });
    
    this.subscriptions.add(sub);
  }
  
  private rejectMockLeaveRequest(id: number): void {
    const index = this.allLeaveRequests.findIndex(r => r.id === id);
    if (index !== -1) {
      const updatedRequest: LeaveRequest = { 
        ...this.allLeaveRequests[index], 
        statuts: 'REJECTED',
        rejection_date: new Date().toISOString()
      };
      this.allLeaveRequests[index] = updatedRequest;
      this.stats = this.calculateStatsFromRequests(this.allLeaveRequests);
      this.showNotification('❌ Demande rejetée', 'warning');
      this.cdr.detectChanges();
    }
  }
  
  private rejectRealLeaveRequest(id: number): void {
    this.uiState.isLoading = true;
    
    this.managerService.rejectLeaveRequest(id).subscribe({
      next: () => {
        this.uiState.isLoading = false;
        this.showNotification('❌ Demande rejetée', 'warning');
        this.refreshData();
      },
      error: (error: Error) => {
        this.uiState.isLoading = false;
        console.error('Erreur rejet:', error);
        this.showNotification(`❌ Erreur: ${error.message}`, 'error');
        this.cdr.detectChanges();
      }
    });
  }
  
  cancelLeaveRequest(request: LeaveRequest): void {
    if (request.statuts !== 'PENDING') {
      this.showNotification('⚠️ Seules les demandes en attente peuvent être annulées', 'warning');
      return;
    }
    
    const dialogRef = this.dialog.open(ConfirmationDialogComponent, {
      width: '400px',
      data: { 
        title: 'Annuler la demande', 
        message: `Êtes-vous sûr de vouloir annuler votre demande de congé ?`,
        type: 'warning'
      }
    });
    
    const sub = dialogRef.afterClosed().subscribe((confirm: boolean) => {
      if (!confirm) return;
      
      if (this.uiState.useMockData) {
        this.cancelMockLeaveRequest(request.id);
      } else {
        this.cancelRealLeaveRequest(request.id);
      }
    });
    
    this.subscriptions.add(sub);
  }
  
  private cancelMockLeaveRequest(id: number): void {
    const index = this.allLeaveRequests.findIndex(r => r.id === id);
    if (index !== -1) {
      const updatedRequest: LeaveRequest = { 
        ...this.allLeaveRequests[index], 
        statuts: 'CANCELLED' 
      };
      this.allLeaveRequests[index] = updatedRequest;
      this.stats = this.calculateStatsFromRequests(this.allLeaveRequests);
      this.showNotification('🔄 Demande annulée avec succès', 'info');
      this.cdr.detectChanges();
    }
  }
  
  private cancelRealLeaveRequest(id: number): void {
    this.uiState.isLoading = true;
    
    this.managerService.cancelLeaveRequest(id).subscribe({
      next: () => {
        this.uiState.isLoading = false;
        this.showNotification('🔄 Demande annulée avec succès', 'info');
        this.refreshData();
      },
      error: (error: Error) => {
        this.uiState.isLoading = false;
        console.error('Erreur annulation:', error);
        this.showNotification(`❌ Erreur: ${error.message}`, 'error');
        this.cdr.detectChanges();
      }
    });
  }
  
  viewLeaveDetails(request: LeaveRequest): void {
    this.dialog.open(LeaveRequestFormComponent, {
      width: '600px',
      data: { 
        leaveRequest: request, 
        isReadOnly: true,
        mode: 'view'
      }
    });
  }
  
  canEditLeaveRequest(request: LeaveRequest): boolean {
    if (this.uiState.useMockData) {
      return request.statuts === 'PENDING';
    }
    return this.managerService.canEditLeaveRequest(request);
  }
  
  // ============================================
  // MÉTHODES UTILITAIRES
  // ============================================
  
  refreshData(): void {
    if (this.uiState.isRefreshing) return;
    
    this.uiState.isRefreshing = true;
    
    if (this.refreshDebounce) {
      clearTimeout(this.refreshDebounce);
    }
    
    this.refreshDebounce = setTimeout(() => {
      this.loadAllData();
      
      setTimeout(() => {
        this.uiState.isRefreshing = false;
        this.cdr.detectChanges();
      }, 800);
    }, 300);
  }
  
  getLeaveAverageResponseTime(): string {
    if (!this.stats?.averageResponseTime || this.stats.averageResponseTime === 0) {
      return 'N/A';
    }
    const avg = this.stats.averageResponseTime;
    return `${avg.toFixed(1)} jour${avg > 1 ? 's' : ''}`;
  }
  
  getTotalPendingLeaveRequests(): number {
    return this.allLeaveRequests.filter(r => r.statuts === 'PENDING').length;
  }
  
  private showNotification(message: string, type: 'success' | 'error' | 'warning' | 'info'): void {
    let panelClass = '';
    switch (type) {
      case 'success': panelClass = 'snackbar-success'; break;
      case 'error': panelClass = 'snackbar-error'; break;
      case 'warning': panelClass = 'snackbar-warning'; break;
      case 'info': panelClass = 'snackbar-info'; break;
    }
    
    this.snackBar.open(message, 'Fermer', {
      duration: 4000,
      horizontalPosition: 'right',
      verticalPosition: 'top',
      panelClass: [panelClass]
    });
  }
  
  toggleMockMode(): void {
    this.uiState.useMockData = !this.uiState.useMockData;
    this.showNotification(
      `Mode ${this.uiState.useMockData ? 'mocké (développement)' : 'API réelle'} activé`, 
      'info'
    );
    this.refreshData();
  }
}