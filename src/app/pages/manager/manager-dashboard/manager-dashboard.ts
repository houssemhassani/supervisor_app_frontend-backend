import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

import { ManagerService, LeaveRequest } from '../../../services/manager';
import { LeaveRequestFormComponent } from '../leave-request-form/leave-request-form';
import { ConfirmationDialogComponent } from '../confirmation-dialog/confirmation-dialog';
import { LeaveRequestListComponent } from '../leave-request-list/leave-request-list';

import { Subscription, forkJoin } from 'rxjs';

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

@Component({
  selector: 'app-manager-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    LeaveRequestListComponent
  ],
  templateUrl: './manager-dashboard.html',
  styleUrls: ['./manager-dashboard.scss']
})
export class ManagerDashboardComponent implements OnInit, OnDestroy {

  myLeaveRequests: LeaveRequest[] = [];
  allLeaveRequests: LeaveRequest[] = [];

  stats: DashboardStats | null = null;
  myStats: DashboardStats | null = null;

  isLoading = true;
  isRefreshing = false;
  activeTab: 'myRequests' | 'allRequests' = 'myRequests';

  private subscriptions = new Subscription();

  constructor(
    private managerService: ManagerService,
    private dialog: MatDialog,
    private snackBar: MatSnackBar
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

    const sub = forkJoin([
      this.managerService.getAllLeaveRequests(),
      this.managerService.getMyLeaveRequests(),
      this.managerService.getStats()
    ]).subscribe({
      next: ([allRes, myRes, statsRes]) => {

        this.allLeaveRequests = allRes?.data || [];
        this.myLeaveRequests = myRes?.data || [];
        this.stats = statsRes?.data || null;

        this.calculateMyStats();

        this.isLoading = false;

        this.snackBar.open('✅ Données chargées', 'Fermer', {
          duration: 3000
        });
      },
      error: () => {
        this.snackBar.open('❌ Erreur chargement', 'Fermer', {
          duration: 4000
        });
        this.isLoading = false;
      }
    });

    this.subscriptions.add(sub);
  }

  refreshData(): void {
    this.isRefreshing = true;
    this.loadAllData();

    setTimeout(() => {
      this.isRefreshing = false;
    }, 800);
  }

  // =========================
  // STATS
  // =========================
  private calculateMyStats(): void {
    if (!this.myLeaveRequests) return;

    const approved = this.myLeaveRequests.filter(r => r.statuts === 'APPROVED');

    let totalDays = 0;

    approved.forEach(r => {
      const start = new Date(r.start_date);
      const end = new Date(r.end_date);

      totalDays +=
        Math.ceil((end.getTime() - start.getTime()) / (1000 * 3600 * 24)) + 1;
    });

    this.myStats = {
      total: this.myLeaveRequests.length,
      pending: this.myLeaveRequests.filter(r => r.statuts === 'PENDING').length,
      approved: approved.length,
      rejected: this.myLeaveRequests.filter(r => r.statuts === 'REJECTED').length,
      cancelled: this.myLeaveRequests.filter(r => r.statuts === 'CANCELLED').length,
      byType: {
        ANNUAL: 0,
        SICK: 0,
        PERSONAL: 0,
        UNPAID: 0,
        MATERNITY: 0,
        OTHER: 0
      },
      totalDaysApproved: totalDays
    };
  }

  getAverageResponseTime(): string {
    const approved = this.allLeaveRequests.filter(r => r.approval_date);

    if (!approved.length) return 'N/A';

    let total = 0;

    approved.forEach(r => {
      const created = new Date(r.created_at || 0);
      const approvedDate = new Date(r.approval_date || 0);

      total +=
        (approvedDate.getTime() - created.getTime()) /
        (1000 * 3600 * 24);
    });

    const avg = total / approved.length;

    return `${avg.toFixed(1)} jour${avg > 1 ? 's' : ''}`;
  }

  getTotalPendingActions(): number {
    return this.allLeaveRequests.filter(r => r.statuts === 'PENDING').length;
  }

  // =========================
  // ACTIONS
  // =========================
  openCreateDialog(): void {
    const dialogRef = this.dialog.open(LeaveRequestFormComponent, {
      width: '600px',
      data: { isReadOnly: false }
    });

    const sub = dialogRef.afterClosed().subscribe(result => {
      if (!result) return;

      this.managerService.createLeaveRequest(result).subscribe(() => {
        this.snackBar.open('✅ Créé', 'Fermer', { duration: 3000 });
        this.refreshData();
      });
    });

    this.subscriptions.add(sub);
  }

  openEditDialog(request: LeaveRequest): void {
    const dialogRef = this.dialog.open(LeaveRequestFormComponent, {
      width: '600px',
      data: { leaveRequest: request }
    });

    const sub = dialogRef.afterClosed().subscribe(result => {
      if (!result) return;

      this.managerService.updateLeaveRequest(request.id, result).subscribe(() => {
        this.snackBar.open('✅ Modifié', 'Fermer', { duration: 3000 });
        this.refreshData();
      });
    });

    this.subscriptions.add(sub);
  }

  deleteLeaveRequest(request: LeaveRequest): void {
    const dialogRef = this.dialog.open(ConfirmationDialogComponent, {
      data: { title: 'Supprimer', message: 'Confirmer ?' }
    });

    const sub = dialogRef.afterClosed().subscribe(confirm => {
      if (!confirm) return;

      this.managerService.deleteLeaveRequest(request.id).subscribe(() => {
        this.snackBar.open('🗑️ Supprimé', 'Fermer', { duration: 3000 });
        this.refreshData();
      });
    });

    this.subscriptions.add(sub);
  }

  approveRequest(request: LeaveRequest): void {
    this.managerService.approveLeaveRequest(request.id).subscribe(() => {
      this.snackBar.open('✅ Approuvé', 'Fermer', { duration: 3000 });
      this.refreshData();
    });
  }

  rejectRequest(request: LeaveRequest): void {
    this.managerService.rejectLeaveRequest(request.id).subscribe(() => {
      this.snackBar.open('❌ Rejeté', 'Fermer', { duration: 3000 });
      this.refreshData();
    });
  }

  cancelRequest(request: LeaveRequest): void {
    this.managerService.cancelLeaveRequest(request.id).subscribe(() => {
      this.snackBar.open('🔄 Annulé', 'Fermer', { duration: 3000 });
      this.refreshData();
    });
  }

  openViewDialog(request: LeaveRequest): void {
    this.dialog.open(LeaveRequestFormComponent, {
      width: '600px',
      data: { leaveRequest: request, isReadOnly: true }
    });
  }

  switchTab(tab: 'myRequests' | 'allRequests'): void {
    this.activeTab = tab;
  }
}