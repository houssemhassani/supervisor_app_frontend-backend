// src/app/pages/manager/manager-dashboard/manager-dashboard.ts
import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatCardModule } from '@angular/material/card';

import { ManagerService, LeaveRequest, Task } from '../../../services/manager';
import { LeaveRequestFormComponent } from '../leave-request-form/leave-request-form';
import { TaskFormComponent } from '../task-form/task-form';
import { ConfirmationDialogComponent } from '../confirmation-dialog/confirmation-dialog';
import { LeaveRequestListComponent } from '../leave-request-list/leave-request-list';
import { TaskListComponent } from '../task-list/task-list';

import { Subscription, forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { HttpErrorResponse } from '@angular/common/http';

interface DashboardStats {
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
}

// Données mockées pour le développement
const MOCK_LEAVE_REQUESTS: LeaveRequest[] = [
  {
    id: 1,
    type: 'ANNUAL',
    start_date: '2026-04-01',
    end_date: '2026-04-10',
    duration_days: 10,
    reason: 'Vacances de printemps',
    statuts: 'PENDING',
    user: { id: 1, username: 'Jean Dupont', email: 'jean@test.com' },
    created_at: new Date().toISOString()
  },
  {
    id: 2,
    type: 'SICK',
    start_date: '2026-04-05',
    end_date: '2026-04-07',
    duration_days: 3,
    reason: 'Arrêt maladie',
    statuts: 'APPROVED',
    user: { id: 2, username: 'Marie Martin', email: 'marie@test.com' },
    created_at: new Date().toISOString(),
    approval_date: new Date().toISOString()
  },
  {
    id: 3,
    type: 'PERSONAL',
    start_date: '2026-04-15',
    end_date: '2026-04-16',
    duration_days: 2,
    reason: 'Rendez-vous personnel',
    statuts: 'PENDING',
    user: { id: 3, username: 'Pierre Durand', email: 'pierre@test.com' },
    created_at: new Date().toISOString()
  },
  {
    id: 4,
    type: 'UNPAID',
    start_date: '2026-04-20',
    end_date: '2026-04-22',
    duration_days: 3,
    reason: 'Congé sans solde',
    statuts: 'REJECTED',
    user: { id: 4, username: 'Sophie Bernard', email: 'sophie@test.com' },
    created_at: new Date().toISOString()
  },
  {
    id: 5,
    type: 'MATERNITY',
    start_date: '2026-05-01',
    end_date: '2026-07-01',
    duration_days: 62,
    reason: 'Congé maternité',
    statuts: 'APPROVED',
    user: { id: 5, username: 'Julie Petit', email: 'julie@test.com' },
    created_at: new Date().toISOString(),
    approval_date: new Date().toISOString()
  }
];

@Component({
  selector: 'app-manager-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    MatCardModule,
    LeaveRequestListComponent,
    TaskListComponent
  ],
  templateUrl: './manager-dashboard.html',
  styleUrls: ['./manager-dashboard.scss']
})
export class ManagerDashboardComponent implements OnInit, OnDestroy {

  // Leave Requests
  myLeaveRequests: LeaveRequest[] = [];
  allLeaveRequests: LeaveRequest[] = [];
  
  // Tasks
  allTasks: Task[] = [];

  // Stats
  stats: DashboardStats | null = null;

  // UI State
  isLoading = true;
  isRefreshing = false;
  leaveSubTab: 'myRequests' | 'allRequests' = 'myRequests';
  useMockData = true; // 🔥 Mettre à false quand l'API sera prête

  private subscriptions = new Subscription();

  constructor(
    private managerService: ManagerService,
    private dialog: MatDialog,
    private snackBar: MatSnackBar,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadAllData();
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  // =========================
  // LOAD DATA
  // =========================
  private loadAllData(): void {
    this.isLoading = true;
    
    // 🔥 Utiliser les données mockées si l'API n'est pas disponible
    if (this.useMockData) {
      setTimeout(() => {
        this.allLeaveRequests = MOCK_LEAVE_REQUESTS;
        this.myLeaveRequests = MOCK_LEAVE_REQUESTS.filter(r => r.user?.id === 1);
        this.allTasks = [];
        this.stats = this.calculateStatsFromRequests(this.allLeaveRequests);
        this.isLoading = false;
        this.cdr.detectChanges();
        this.snackBar.open('✅ Données chargées (mode développement)', 'Fermer', { duration: 3000 });
      }, 500);
      return;
    }
    
    // Appels API réels (quand les permissions seront configurées)
    const allLeaveRequests$ = this.managerService.getAllLeaveRequests().pipe(
      catchError((error: HttpErrorResponse) => {
        console.error('Erreur chargement leave requests:', error);
        if (error.status === 403) {
          this.snackBar.open('⚠️ Permissions insuffisantes pour voir les demandes', 'Fermer', { duration: 5000 });
        }
        return of({ data: [] });
      })
    );
    
    const myLeaveRequests$ = this.managerService.getMyLeaveRequests().pipe(
      catchError((error: HttpErrorResponse) => {
        console.error('Erreur chargement mes demandes:', error);
        return of({ data: [] });
      })
    );
    
    const allTasks$ = this.managerService.getAllTasks().pipe(
      catchError((error: HttpErrorResponse) => {
        console.error('Erreur chargement tâches:', error);
        return of({ data: [] });
      })
    );

    const sub = forkJoin([
      allLeaveRequests$,
      myLeaveRequests$,
      allTasks$
    ]).subscribe({
      next: ([allLeaveRes, myLeaveRes, allTasksRes]) => {
        this.allLeaveRequests = allLeaveRes?.data || [];
        this.myLeaveRequests = myLeaveRes?.data || [];
        this.allTasks = allTasksRes?.data || [];
        this.stats = this.calculateStatsFromRequests(this.allLeaveRequests);
        
        setTimeout(() => {
          this.isLoading = false;
          this.cdr.detectChanges();
        }, 0);
        
        const totalRequests = this.allLeaveRequests.length;
        if (totalRequests > 0) {
          this.snackBar.open(`✅ ${totalRequests} demandes chargées`, 'Fermer', { duration: 2000 });
        } else {
          this.snackBar.open('✅ Données chargées (aucune demande)', 'Fermer', { duration: 2000 });
        }
      },
      error: (error: HttpErrorResponse) => {
        console.error('Erreur générale:', error);
        this.stats = this.getEmptyStats();
        
        setTimeout(() => {
          this.isLoading = false;
          this.cdr.detectChanges();
        }, 0);
        
        this.snackBar.open('❌ Erreur lors du chargement des données', 'Fermer', { duration: 4000 });
      }
    });

    this.subscriptions.add(sub);
  }

  // Calculer les stats à partir des demandes
  private calculateStatsFromRequests(requests: LeaveRequest[]): DashboardStats {
    const total = requests.length;
    const pending = requests.filter(r => r.statuts === 'PENDING').length;
    const approvedRequests = requests.filter(r => r.statuts === 'APPROVED');
    const approved = approvedRequests.length;
    const rejected = requests.filter(r => r.statuts === 'REJECTED').length;
    const cancelled = requests.filter(r => r.statuts === 'CANCELLED').length;
    
    let totalDaysApproved = 0;
    
    for (const request of approvedRequests) {
      const start = new Date(request.start_date);
      const end = new Date(request.end_date);
      const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 3600 * 24)) + 1;
      totalDaysApproved += days;
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
      totalDaysApproved
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
      totalDaysApproved: 0
    };
  }

  refreshData(): void {
    this.isRefreshing = true;
    this.loadAllData();

    setTimeout(() => {
      this.isRefreshing = false;
    }, 800);
  }

  // =========================
  // LEAVE REQUESTS ACTIONS
  // =========================
  openCreateLeaveDialog(): void {
    const dialogRef = this.dialog.open(LeaveRequestFormComponent, {
      width: '600px',
      data: { isReadOnly: false }
    });

    const sub = dialogRef.afterClosed().subscribe((result: any) => {
      if (!result) return;

      if (this.useMockData) {
        // Mode mocké
        const newRequest: LeaveRequest = {
          id: Date.now(),
          ...result,
          statuts: 'PENDING',
          user: { id: 1, username: 'Moi', email: 'moi@test.com' },
          created_at: new Date().toISOString()
        };
        this.allLeaveRequests = [newRequest, ...this.allLeaveRequests];
        this.myLeaveRequests = [newRequest, ...this.myLeaveRequests];
        this.stats = this.calculateStatsFromRequests(this.allLeaveRequests);
        this.snackBar.open('✅ Demande créée (mode test)', 'Fermer', { duration: 3000 });
        this.cdr.detectChanges();
      } else {
        this.managerService.createLeaveRequest(result).subscribe({
          next: () => {
            this.snackBar.open('✅ Demande de congé créée', 'Fermer', { duration: 3000 });
            this.refreshData();
          },
          error: (error: HttpErrorResponse) => {
            console.error('Erreur création:', error);
            this.snackBar.open('❌ Erreur lors de la création', 'Fermer', { duration: 3000 });
          }
        });
      }
    });

    this.subscriptions.add(sub);
  }

  openEditLeaveDialog(request: LeaveRequest): void {
    const dialogRef = this.dialog.open(LeaveRequestFormComponent, {
      width: '600px',
      data: { leaveRequest: request }
    });

    const sub = dialogRef.afterClosed().subscribe((result: any) => {
      if (!result) return;

      if (this.useMockData) {
        // Mode mocké
        const index = this.allLeaveRequests.findIndex(r => r.id === request.id);
        if (index !== -1) {
          this.allLeaveRequests[index] = { ...this.allLeaveRequests[index], ...result };
          this.stats = this.calculateStatsFromRequests(this.allLeaveRequests);
          this.snackBar.open('✅ Demande modifiée (mode test)', 'Fermer', { duration: 3000 });
          this.cdr.detectChanges();
        }
      } else {
        this.managerService.updateLeaveRequest(request.id, result).subscribe({
          next: () => {
            this.snackBar.open('✅ Demande modifiée', 'Fermer', { duration: 3000 });
            this.refreshData();
          },
          error: (error: HttpErrorResponse) => {
            console.error('Erreur modification:', error);
            this.snackBar.open('❌ Erreur lors de la modification', 'Fermer', { duration: 3000 });
          }
        });
      }
    });

    this.subscriptions.add(sub);
  }

  deleteLeaveRequest(request: LeaveRequest): void {
    const dialogRef = this.dialog.open(ConfirmationDialogComponent, {
      data: { title: 'Supprimer', message: 'Confirmer la suppression de cette demande ?' }
    });

    const sub = dialogRef.afterClosed().subscribe((confirm: boolean) => {
      if (!confirm) return;

      if (this.useMockData) {
        // Mode mocké
        this.allLeaveRequests = this.allLeaveRequests.filter(r => r.id !== request.id);
        this.myLeaveRequests = this.myLeaveRequests.filter(r => r.id !== request.id);
        this.stats = this.calculateStatsFromRequests(this.allLeaveRequests);
        this.snackBar.open('🗑️ Demande supprimée (mode test)', 'Fermer', { duration: 3000 });
        this.cdr.detectChanges();
      } else {
        this.managerService.deleteLeaveRequest(request.id).subscribe({
          next: () => {
            this.snackBar.open('🗑️ Demande supprimée', 'Fermer', { duration: 3000 });
            this.refreshData();
          },
          error: (error: HttpErrorResponse) => {
            console.error('Erreur suppression:', error);
            this.snackBar.open('❌ Erreur lors de la suppression', 'Fermer', { duration: 3000 });
          }
        });
      }
    });

    this.subscriptions.add(sub);
  }

  approveLeaveRequest(request: LeaveRequest): void {
    if (this.useMockData) {
      // Mode mocké
      const index = this.allLeaveRequests.findIndex(r => r.id === request.id);
      if (index !== -1) {
        this.allLeaveRequests[index] = { 
          ...this.allLeaveRequests[index], 
          statuts: 'APPROVED',
          approval_date: new Date().toISOString()
        };
        this.stats = this.calculateStatsFromRequests(this.allLeaveRequests);
        this.snackBar.open('✅ Demande approuvée (mode test)', 'Fermer', { duration: 3000 });
        this.cdr.detectChanges();
      }
    } else {
      this.managerService.approveLeaveRequest(request.id).subscribe({
        next: () => {
          this.snackBar.open('✅ Demande approuvée', 'Fermer', { duration: 3000 });
          this.refreshData();
        },
        error: (error: HttpErrorResponse) => {
          console.error('Erreur approbation:', error);
          this.snackBar.open('❌ Erreur lors de l\'approbation', 'Fermer', { duration: 3000 });
        }
      });
    }
  }

  rejectLeaveRequest(request: LeaveRequest): void {
    if (this.useMockData) {
      // Mode mocké
      const index = this.allLeaveRequests.findIndex(r => r.id === request.id);
      if (index !== -1) {
        this.allLeaveRequests[index] = { ...this.allLeaveRequests[index], statuts: 'REJECTED' };
        this.stats = this.calculateStatsFromRequests(this.allLeaveRequests);
        this.snackBar.open('❌ Demande rejetée (mode test)', 'Fermer', { duration: 3000 });
        this.cdr.detectChanges();
      }
    } else {
      this.managerService.rejectLeaveRequest(request.id).subscribe({
        next: () => {
          this.snackBar.open('❌ Demande rejetée', 'Fermer', { duration: 3000 });
          this.refreshData();
        },
        error: (error: HttpErrorResponse) => {
          console.error('Erreur rejet:', error);
          this.snackBar.open('❌ Erreur lors du rejet', 'Fermer', { duration: 3000 });
        }
      });
    }
  }

  cancelLeaveRequest(request: LeaveRequest): void {
    if (this.useMockData) {
      // Mode mocké
      const index = this.allLeaveRequests.findIndex(r => r.id === request.id);
      if (index !== -1) {
        this.allLeaveRequests[index] = { ...this.allLeaveRequests[index], statuts: 'CANCELLED' };
        this.stats = this.calculateStatsFromRequests(this.allLeaveRequests);
        this.snackBar.open('🔄 Demande annulée (mode test)', 'Fermer', { duration: 3000 });
        this.cdr.detectChanges();
      }
    } else {
      this.managerService.cancelLeaveRequest(request.id).subscribe({
        next: () => {
          this.snackBar.open('🔄 Demande annulée', 'Fermer', { duration: 3000 });
          this.refreshData();
        },
        error: (error: HttpErrorResponse) => {
          console.error('Erreur annulation:', error);
          this.snackBar.open('❌ Erreur lors de l\'annulation', 'Fermer', { duration: 3000 });
        }
      });
    }
  }

  viewLeaveDetails(request: LeaveRequest): void {
    this.dialog.open(LeaveRequestFormComponent, {
      width: '600px',
      data: { leaveRequest: request, isReadOnly: true }
    });
  }

  // =========================
  // TASKS ACTIONS
  // =========================
  openCreateTaskDialog(): void {
    const dialogRef = this.dialog.open(TaskFormComponent, {
      width: '600px',
      data: { isReadOnly: false }
    });

    const sub = dialogRef.afterClosed().subscribe((result: any) => {
      if (!result) return;

      this.managerService.createTask(result).subscribe({
        next: () => {
          this.snackBar.open('✅ Tâche créée', 'Fermer', { duration: 3000 });
          this.refreshData();
        },
        error: (error: HttpErrorResponse) => {
          console.error('Erreur création tâche:', error);
          this.snackBar.open('❌ Erreur lors de la création', 'Fermer', { duration: 3000 });
        }
      });
    });

    this.subscriptions.add(sub);
  }

  openEditTaskDialog(task: Task): void {
    const dialogRef = this.dialog.open(TaskFormComponent, {
      width: '600px',
      data: { task: task }
    });

    const sub = dialogRef.afterClosed().subscribe((result: any) => {
      if (!result) return;

      this.managerService.updateTask(task.id, result).subscribe({
        next: () => {
          this.snackBar.open('✅ Tâche modifiée', 'Fermer', { duration: 3000 });
          this.refreshData();
        },
        error: (error: HttpErrorResponse) => {
          console.error('Erreur modification tâche:', error);
          this.snackBar.open('❌ Erreur lors de la modification', 'Fermer', { duration: 3000 });
        }
      });
    });

    this.subscriptions.add(sub);
  }

  deleteTask(task: Task): void {
    const dialogRef = this.dialog.open(ConfirmationDialogComponent, {
      data: { title: 'Supprimer', message: 'Confirmer la suppression de cette tâche ?' }
    });

    const sub = dialogRef.afterClosed().subscribe((confirm: boolean) => {
      if (!confirm) return;

      this.managerService.deleteTask(task.id).subscribe({
        next: () => {
          this.snackBar.open('🗑️ Tâche supprimée', 'Fermer', { duration: 3000 });
          this.refreshData();
        },
        error: (error: HttpErrorResponse) => {
          console.error('Erreur suppression tâche:', error);
          this.snackBar.open('❌ Erreur lors de la suppression', 'Fermer', { duration: 3000 });
        }
      });
    });

    this.subscriptions.add(sub);
  }

  updateTaskStatus(task: Task, status: string): void {
    this.managerService.updateTaskStatus(task.id, status).subscribe({
      next: () => {
        this.snackBar.open(`✅ Statut mis à jour: ${status}`, 'Fermer', { duration: 3000 });
        this.refreshData();
      },
      error: (error: HttpErrorResponse) => {
        console.error('Erreur mise à jour statut:', error);
        this.snackBar.open('❌ Erreur lors de la mise à jour', 'Fermer', { duration: 3000 });
      }
    });
  }

  viewTaskDetails(task: Task): void {
    this.dialog.open(TaskFormComponent, {
      width: '600px',
      data: { task: task, isReadOnly: true }
    });
  }

  // =========================
  // UI HELPERS
  // =========================
  switchLeaveSubTab(tab: 'myRequests' | 'allRequests'): void {
    this.leaveSubTab = tab;
  }

  getLeaveAverageResponseTime(): string {
    const approved = this.allLeaveRequests.filter(r => r.approval_date);
    if (!approved.length) return 'N/A';

    let total = 0;
    approved.forEach(r => {
      const created = new Date(r.created_at || 0);
      const approvedDate = new Date(r.approval_date || 0);
      total += (approvedDate.getTime() - created.getTime()) / (1000 * 3600 * 24);
    });

    const avg = total / approved.length;
    return `${avg.toFixed(1)} jour${avg > 1 ? 's' : ''}`;
  }

  getTotalPendingLeaveRequests(): number {
    return this.allLeaveRequests.filter(r => r.statuts === 'PENDING').length;
  }
}