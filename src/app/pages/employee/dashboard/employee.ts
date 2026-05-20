// src/app/pages/employee-dashboard/employee-dashboard.component.ts
/**
 * Dashboard Employé - Remote Work Supervisor
 * Version: 2.3.0 - Version finale complète et optimisée
 * 
 * Fonctionnalités:
 * - Pointage (check-in/out) avec géolocalisation
 * - Gestion des pauses
 * - Suivi d'activité (clics souris/clavier)
 * - Captures d'écran automatiques
 * - Score IA de productivité
 * - Gestion des tâches
 * - Demandes de congé
 */

import { Component, OnInit, OnDestroy, ChangeDetectorRef, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClientModule } from '@angular/common/http';
import { Router } from '@angular/router';
import { Chart, ChartConfiguration, registerables } from 'chart.js';
import { BaseChartDirective } from 'ng2-charts';
import { interval, Subscription, catchError, of, finalize, Subject, timer } from 'rxjs';
import { takeUntil, debounceTime } from 'rxjs/operators';
import { AuthService } from '../../../core/services/AuthService/auth';
import { EmployeeApiService, TodayDashboardResponse } from "../../../services/employee";
import { AiScoreService, ProductivityResponse } from '../../../services/ai-score';

Chart.register(...registerables);

// ============================================
// INTERFACES
// ============================================

interface Task {
  id: number;
  title: string;
  description: string;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  statuts: 'TODO' | 'IN_PROGRESS' | 'DONE';
  due_date: string;
  assigned_to?: any;
}

interface LeaveRequest {
  id: number;
  type: string;
  start_date: string;
  end_date: string;
  reason: string;
  statuts: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
  created_at?: string;
}

interface Notification {
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
  icon: string;
}

interface ActivityStats {
  total_keyboard_clicks: number;
  total_mouse_clicks: number;
  avg_activity_level: number;
  logs_count: number;
  trend?: number;
  min_activity_level?: number;
  max_activity_level?: number;
}

@Component({
  selector: 'app-employee-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, HttpClientModule, BaseChartDirective],
  templateUrl: './employee.html',
  styleUrls: ['./employee.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EmployeeDashboardComponent implements OnInit, OnDestroy {
  
  // ============================================
  // PROPRIÉTÉS PUBLIQUES
  // ============================================
  
  currentDate = new Date();
  isLoading = false;
  
  // Notification
  notification: Notification | null = null;
  showNotification = false;
  
  // User data
  user: any = null;
  
  // Attendance
  isCheckedIn = false;
  isCheckedOut = false;
  isOnBreak = false;
  startTime: Date | null = null;
  workHoursToday = 0;
  breakHoursToday = 0;
  breakDuration = 0;
  attendanceId: number | null = null;
  timeLogId: number | null = null;
  activeBreakId: number | null = null;
  
  // Status display
  currentStatus: string = '📅 Non pointé';
  currentStatusClass: string = 'status-not-checked';
  attendanceStatus: string = '';
  lateMinutes: number = 0;
  
  // Tasks
  tasks: Task[] = [];
  filteredTasks: Task[] = [];
  taskFilter: 'all' | 'TODO' | 'IN_PROGRESS' | 'DONE' = 'all';
  tasksCompleted = 0;
  totalTasks = 0;
  
  // Leave
  leaveRequests: LeaveRequest[] = [];
  leaveBalance = 25;
  pendingRequests = 0;
  showLeaveModal = false;
  editingLeaveId: number | null = null;
  newLeave = {
    type: 'ANNUAL',
    start_date: '',
    end_date: '',
    reason: ''
  };
  leaveValidationErrors: string[] = [];
  
  // Delete confirmation modal
  showDeleteModal = false;
  deleteRequestId: number | null = null;
  deleteRequestTitle: string = '';
  
  // Chart
  weeklyData: ChartConfiguration<'line'>['data'] = {
    labels: ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'],
    datasets: [{
      data: [0, 0, 0, 0, 0, 0],
      label: 'Heures travaillées',
      backgroundColor: 'rgba(102, 126, 234, 0.2)',
      borderColor: '#667eea',
      borderWidth: 3,
      tension: 0.4,
      fill: true,
      pointBackgroundColor: '#764ba2',
      pointBorderColor: 'white',
      pointRadius: 4,
      pointHoverRadius: 6
    }]
  };
  
  chartOptions: ChartConfiguration<'line'>['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: true,
        position: 'top',
        labels: { color: '#333', font: { size: 12 } }
      },
      tooltip: {
        backgroundColor: 'rgba(0,0,0,0.8)',
        titleColor: 'white',
        bodyColor: 'white'
      }
    },
    scales: {
      y: { 
        beginAtZero: true, 
        max: 10, 
        grid: { color: '#e0e0e0' }, 
        title: { display: true, text: 'Heures', color: '#666' } 
      },
      x: { 
        grid: { display: false }, 
        ticks: { color: '#666' } 
      }
    }
  };
  
  // Activity tracking
  todayMouseClicks: number = 0;
  todayKeyboardClicks: number = 0;
  todayActivityLevel: number = 0;
  todayActivityLogsCount: number = 0;
  inactiveDisplayMinutes: number = 0;
  isUserActive: boolean = true;
  activityTrend: number = 0;
  
  // AI Score
  aiScore: number = 0;
  aiLevel: string = '';
  aiLevelIcon: string = '';
  aiLevelColor: string = '';
  aiRecommendations: string[] = [];
  aiRecommendationsDetailed: any[] = [];
  aiPenalties: any[] = [];
  aiBonuses: any[] = [];
  isCalculatingScore: boolean = false;
  
  // User menu
  isUserMenuOpen: boolean = false;
  
  // Logo error
  logoError: boolean = false;
  
  // ============================================
  // PROPRIÉTÉS PRIVÉES
  // ============================================
  
  private breakInterval: any;
  private refreshSubscription?: Subscription;
  private tasksSubscription?: Subscription;
  private activityInterval: any;
  private inactivityCheckInterval: any;
  private screenshotInterval: any;
  private destroy$ = new Subject<void>();
  
  // Activity tracking
  private keyboardClicks = 0;
  private mouseClicks = 0;
  private currentActivityLevel = 100;
  private lastActivityTime = Date.now();
  private readonly INACTIVITY_THRESHOLD = 15; // 15 minutes
  private readonly SEND_INTERVAL = 60000; // 1 minute
  private readonly SCREENSHOT_INTERVAL = 600000; // 10 minutes
  private activityListeners: Map<string, () => void> = new Map();
  
  // ============================================
  // CONSTRUCTEUR
  // ============================================
  
  constructor(
    private apiService: EmployeeApiService,
    private authService: AuthService,
    private aiScoreService: AiScoreService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}
  
  // ============================================
  // LIFECYCLE HOOKS
  // ============================================
  
  ngOnInit(): void {
    console.log('🚀 [EmployeeDashboard] Initialisation');
    this.loadUserData();
    this.loadTodayAttendance();
    this.loadTasks();
    this.loadLeaveRequests();
    this.loadWeeklyStats();
    this.loadTodayActivityStats();
    
    this.initActivityTracking();
    this.startAutoScreenshots();
    
    // Attendre un peu avant de calculer le score IA
    timer(2000).pipe(takeUntil(this.destroy$)).subscribe(() => {
      this.calculateAIScore();
    });
    
    // Rafraîchissement périodique (toutes les minutes)
    this.refreshSubscription = interval(60000).pipe(
      takeUntil(this.destroy$)
    ).subscribe(() => {
      console.log('🔄 Auto-refresh des données...');
      this.refreshData();
    });
  }
  
  ngOnDestroy(): void {
    console.log('🛑 [EmployeeDashboard] Destruction');
    this.destroy$.next();
    this.destroy$.complete();
    
    this.stopIntervals();
    this.stopActivityTracking();
  }
  
  private stopIntervals(): void {
    if (this.breakInterval) {
      clearInterval(this.breakInterval);
      this.breakInterval = null;
    }
    if (this.screenshotInterval) {
      clearInterval(this.screenshotInterval);
      this.screenshotInterval = null;
    }
  }
  
  // ============================================
  // USER METHODS
  // ============================================
  
  private loadUserData(): void {
    const currentUser = this.authService.getCurrentUser();
    
    if (currentUser) {
      this.user = {
        id: currentUser.id,
        username: currentUser.username || currentUser.email?.split('@')[0] || 'Employé',
        email: currentUser.email,
        role: currentUser.role?.name?.toUpperCase() || 'EMPLOYEE',
        department: currentUser.department,
        position: currentUser.position
      };
      console.log('✅ Utilisateur chargé:', this.user);
    } else {
      this.user = { 
        id: 1,
        username: 'Employé', 
        email: 'employe@test.com', 
        role: 'EMPLOYEE' 
      };
    }
    this.cdr.detectChanges();
  }
  
  /**
   * Gestion d'erreur si le logo n'est pas trouvé
   */
  onLogoError(event: Event): void {
    this.logoError = true;
    const img = event.target as HTMLImageElement;
    img.style.display = 'none';
    console.warn('Logo non trouvé, vérifiez le chemin assets/logo.png');
  }
  
  toggleUserMenu(): void {
    this.isUserMenuOpen = !this.isUserMenuOpen;
  }
  
  goToProfile(): void {
    this.isUserMenuOpen = false;
    this.router.navigate(['/employee/profile']);
  }
  
  logout(): void {
    this.isUserMenuOpen = false;
    this.authService.logout();
    this.router.navigate(['/login']);
  }
  
  // ============================================
  // FORMATAGE
  // ============================================
  
  formatDate(dateString: string): string {
    if (!dateString) return '';
    try {
      return new Date(dateString).toLocaleDateString('fr-FR', {
        day: '2-digit', 
        month: '2-digit', 
        year: 'numeric'
      });
    } catch { 
      return dateString; 
    }
  }
  
  formatDateForInput(dateString: string): string {
    if (!dateString) return '';
    return new Date(dateString).toISOString().split('T')[0];
  }
  
  formatDateTime(date: Date | string | null): string {
    if (!date) return '';
    try {
      return new Date(date).toLocaleString('fr-FR', {
        day: '2-digit', 
        month: '2-digit', 
        year: 'numeric',
        hour: '2-digit', 
        minute: '2-digit'
      });
    } catch { 
      return String(date); 
    }
  }
  
  // ============================================
  // ATTENDANCE METHODS
  // ============================================
  
  private loadTodayAttendance(): void {
    if (!this.apiService.isAuthenticated()) {
      this.setMockAttendance();
      return;
    }
    
    this.apiService.getTodayDashboard().subscribe({
      next: (response: TodayDashboardResponse) => {
        if (response?.success) {
          const data = response.data;
          this.isCheckedIn = !!data.attendance?.checkIn;
          this.isCheckedOut = !!data.attendance?.checkOut;
          this.isOnBreak = !!data.currentSession?.isOnBreak;
          this.workHoursToday = data.attendance?.workHours || 0;
          this.breakHoursToday = data.attendance?.breakHours || 0;
          this.startTime = data.attendance?.checkIn ? new Date(data.attendance.checkIn) : null;
          this.attendanceId = data.attendance?.id || null;
          this.attendanceStatus = data.attendance?.status || 'ABSENT';
          this.lateMinutes = data.attendance?.lateMinutes || 0;
          
          this.updateStatusDisplay(this.attendanceStatus);
          this.cdr.detectChanges();
        }
      },
      error: (error) => {
        console.error('❌ Erreur chargement présence:', error);
        this.setMockAttendance();
      }
    });
  }
  
  private setMockAttendance(): void {
    this.isCheckedIn = false;
    this.isCheckedOut = false;
    this.isOnBreak = false;
    this.workHoursToday = 0;
    this.breakHoursToday = 0;
    this.attendanceStatus = 'ABSENT';
    this.updateStatusDisplay('ABSENT');
    this.cdr.detectChanges();
  }
  
  checkIn(): void {
    if (this.isCheckedIn) {
      this.showNotificationMessage('Vous avez déjà pointé aujourd\'hui', 'error');
      return;
    }
    
    if (!this.apiService.isAuthenticated()) {
      this.showNotificationMessage('Veuillez vous connecter d\'abord', 'error');
      return;
    }
    
    this.isLoading = true;
    
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => this.sendCheckIn({ 
          latitude: position.coords.latitude, 
          longitude: position.coords.longitude 
        }),
        () => this.sendCheckIn(null)
      );
    } else {
      this.sendCheckIn(null);
    }
  }
  
  private sendCheckIn(locationData: any): void {
    const body: any = {};
    if (locationData) {
      body.location = locationData;
      body.latitude = locationData.latitude;
      body.longitude = locationData.longitude;
    }
    
    this.apiService.checkIn(body).pipe(
      catchError((error) => {
        const errorMessage = error.status === 401 
          ? 'Session expirée. Veuillez vous reconnecter.' 
          : error.error?.message || 'Erreur lors du check-in';
        this.showNotificationMessage(errorMessage, 'error');
        return of(null);
      }),
      finalize(() => { 
        this.isLoading = false; 
        this.cdr.detectChanges(); 
      })
    ).subscribe((response: any) => {
      if (response?.success) {
        this.isCheckedIn = true;
        this.startTime = new Date();
        this.attendanceId = response.data?.attendance?.id;
        this.timeLogId = response.data?.timeLog?.id;
        
        const lateMsg = response.data?.isLate ? ` (${response.data.lateMinutes} minutes de retard)` : '';
        this.showNotificationMessage(`Check-in effectué avec succès${lateMsg}!`, 'success');
        this.loadTodayAttendance();
      }
    });
  }
  
  checkOut(): void {
    if (!this.isCheckedIn) {
      this.showNotificationMessage('Vous n\'avez pas encore pointé', 'error');
      return;
    }
    if (this.isCheckedOut) {
      this.showNotificationMessage('Vous avez déjà pointé votre sortie', 'error');
      return;
    }
    
    this.isLoading = true;
    
    this.apiService.checkOut().pipe(
      catchError((error) => {
        this.showNotificationMessage('Erreur lors du check-out', 'error');
        return of(null);
      }),
      finalize(() => { 
        this.isLoading = false; 
        this.cdr.detectChanges(); 
      })
    ).subscribe((response: any) => {
      if (response?.success) {
        this.isCheckedOut = true;
        this.isCheckedIn = false;
        this.isOnBreak = false;
        this.attendanceStatus = response.data?.status || 'PRESENT';
        
        if (this.breakInterval) {
          clearInterval(this.breakInterval);
          this.breakInterval = null;
        }
        
        const workHours = response.data?.workHours || 0;
        const statusMessage = this.attendanceStatus === 'ABSENT' || this.attendanceStatus === 'PARTIAL' 
          ? '⚠️ Attention: Moins de 8h travaillées' 
          : '✅ Journée complète';
        
        this.showNotificationMessage(`Check-out effectué. ${workHours.toFixed(2)}h travaillées. ${statusMessage}`, 'success');
        this.loadTodayAttendance();
      }
    });
  }
  
  startBreak(): void {
    if (!this.isCheckedIn) {
      this.showNotificationMessage('Vous devez d\'abord pointer votre arrivée', 'error');
      return;
    }
    if (this.isOnBreak) {
      this.showNotificationMessage('Vous êtes déjà en pause', 'error');
      return;
    }
    if (this.isCheckedOut) {
      this.showNotificationMessage('Vous avez déjà terminé votre journée', 'error');
      return;
    }
    
    this.isLoading = true;
    
    this.apiService.startBreak({ type: 'SHORT' }).pipe(
      catchError((error) => {
        this.showNotificationMessage(error.error?.message || 'Erreur lors du début de pause', 'error');
        return of(null);
      }),
      finalize(() => { 
        this.isLoading = false; 
        this.cdr.detectChanges(); 
      })
    ).subscribe((response: any) => {
      if (response?.success) {
        this.isOnBreak = true;
        this.activeBreakId = response.data?.id;
        this.breakDuration = 0;
        this.showNotificationMessage('Pause démarrée', 'success');
        
        if (this.breakInterval) {
          clearInterval(this.breakInterval);
        }
        this.breakInterval = setInterval(() => {
          if (this.isOnBreak) {
            this.breakDuration++;
            this.cdr.detectChanges();
          }
        }, 60000);
        this.loadTodayAttendance();
      }
    });
  }
  
  endBreak(): void {
    if (!this.isOnBreak) {
      this.showNotificationMessage('Vous n\'êtes pas en pause', 'error');
      return;
    }
    
    this.isLoading = true;
    
    this.apiService.endBreak().subscribe({
      next: (response: any) => {
        if (response?.success) {
          this.isOnBreak = false;
          this.activeBreakId = null;
          if (this.breakInterval) {
            clearInterval(this.breakInterval);
            this.breakInterval = null;
          }
          this.showNotificationMessage(`Pause terminée après ${response.data?.durationMinutes || this.breakDuration} minutes`, 'success');
          this.loadTodayAttendance();
        }
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: (error) => {
        this.showNotificationMessage('Erreur lors de la fin de pause', 'error');
        this.isLoading = false;
        this.cdr.detectChanges();
      }
    });
  }
  
  private updateStatusDisplay(status: string): void {
    const statusMap: Record<string, { text: string; class: string }> = {
      'PRESENT': { text: '✅ Présent', class: 'status-present' },
      'LATE': { text: '⚠️ En retard', class: 'status-late' },
      'PARTIAL': { text: '⏳ Journée incomplète', class: 'status-partial' },
      'ABSENT': { text: '❌ Absent', class: 'status-absent' }
    };
    
    const defaultStatus = { text: '📅 Non pointé', class: 'status-not-checked' };
    const statusInfo = statusMap[status] || defaultStatus;
    this.currentStatus = statusInfo.text;
    this.currentStatusClass = statusInfo.class;
    this.cdr.detectChanges();
  }
  
  // ============================================
  // TASKS METHODS
  // ============================================
  
  private loadTasks(): void {
    if (this.tasksSubscription) {
      this.tasksSubscription.unsubscribe();
    }
    
    if (!this.apiService.isAuthenticated()) {
      this.setMockTasks();
      return;
    }
    
    const userId = this.user?.id || 1;
    this.tasksSubscription = this.apiService.getTasks(userId).subscribe({
      next: (response: any) => {
        let rawTasks: any[] = [];
        
        if (response?.data) {
          if (Array.isArray(response.data)) {
            rawTasks = response.data;
          } else if (response.data.data && Array.isArray(response.data.data)) {
            rawTasks = response.data.data;
          }
        }
        
        const uniqueTasks = new Map<number, any>();
        rawTasks.forEach(task => { 
          if (task?.id && !uniqueTasks.has(task.id)) {
            uniqueTasks.set(task.id, task);
          }
        });
        
        this.tasks = Array.from(uniqueTasks.values())
          .filter((task: any) => {
            const assignedTo = task.assigned_to;
            if (!assignedTo) return false;
            if (typeof assignedTo === 'object') return assignedTo.id === userId;
            if (typeof assignedTo === 'number') return assignedTo === userId;
            return false;
          })
          .sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime());
        
        this.filterTasks();
        this.updateTaskStats();
        this.cdr.detectChanges();
      },
      error: () => {
        this.setMockTasks();
        this.cdr.detectChanges();
      }
    });
  }
  
  private setMockTasks(): void {
    this.tasks = [
      { 
        id: 1, 
        title: 'Développer le dashboard employé', 
        description: 'Créer l\'interface utilisateur', 
        priority: 'HIGH', 
        statuts: 'IN_PROGRESS', 
        due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] 
      },
      { 
        id: 2, 
        title: 'Rédiger la documentation', 
        description: 'Documenter les fonctionnalités', 
        priority: 'MEDIUM', 
        statuts: 'TODO', 
        due_date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] 
      },
      { 
        id: 3, 
        title: 'Tester les fonctionnalités', 
        description: 'Effectuer les tests unitaires', 
        priority: 'LOW', 
        statuts: 'DONE', 
        due_date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] 
      }
    ] as Task[];
    this.filterTasks();
    this.updateTaskStats();
    this.cdr.detectChanges();
  }
  
  filterTasks(): void {
    if (this.taskFilter === 'all') {
      this.filteredTasks = [...this.tasks];
    } else {
      this.filteredTasks = this.tasks.filter(task => task.statuts === this.taskFilter);
    }
    this.cdr.detectChanges();
  }
  
  private updateTaskStats(): void {
    this.totalTasks = this.tasks.length;
    this.tasksCompleted = this.tasks.filter(t => t.statuts === 'DONE').length;
    this.cdr.detectChanges();
  }
  
  updateTaskStatus(task: Task): void {
    if (task.statuts === 'DONE') {
      this.showNotificationMessage('Cette tâche est déjà terminée', 'error');
      return;
    }
    
    this.apiService.updateTaskStatus(task.id, 'DONE').subscribe({
      next: () => {
        task.statuts = 'DONE';
        this.updateTaskStats();
        this.filterTasks();
        this.showNotificationMessage('Tâche marquée comme terminée!', 'success');
        this.cdr.detectChanges();
      },
      error: () => {
        this.showNotificationMessage('Erreur lors de la mise à jour', 'error');
      }
    });
  }
  
  getStatusLabel(status: string): string {
    const labels: Record<string, string> = { 
      'TODO': 'À faire', 
      'IN_PROGRESS': 'En cours', 
      'DONE': 'Terminé' 
    };
    return labels[status] || status;
  }
  
  /**
   * Retourne le nombre de tâches par statut
   */
  getStatusCount(status: string): number {
    return this.tasks.filter(t => t.statuts === status).length;
  }
  
  /**
   * Vérifie si une tâche est en retard
   */
  isTaskOverdue(dueDate: string): boolean {
    if (!dueDate) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = new Date(dueDate);
    due.setHours(0, 0, 0, 0);
    return due < today;
  }
  
  // ============================================
  // LEAVE REQUESTS METHODS
  // ============================================
  
  private loadLeaveRequests(): void {
    if (!this.apiService.isAuthenticated()) {
      this.setMockLeaveRequests();
      return;
    }
    
    this.apiService.getLeaveRequests().subscribe({
      next: (response) => {
        if (response?.data) {
          this.leaveRequests = response.data;
          this.pendingRequests = this.leaveRequests.filter(r => r.statuts === 'PENDING').length;
          this.cdr.detectChanges();
        }
      },
      error: () => {
        this.setMockLeaveRequests();
        this.cdr.detectChanges();
      }
    });
  }
  
  private setMockLeaveRequests(): void {
    this.leaveRequests = [
      { 
        id: 1, 
        type: 'ANNUAL', 
        start_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], 
        end_date: new Date(Date.now() + 35 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], 
        reason: 'Vacances de printemps', 
        statuts: 'PENDING', 
        created_at: new Date().toISOString() 
      }
    ];
    this.pendingRequests = this.leaveRequests.filter(r => r.statuts === 'PENDING').length;
    this.cdr.detectChanges();
  }
  
  openLeaveModal(): void {
    this.newLeave = { type: 'ANNUAL', start_date: '', end_date: '', reason: '' };
    this.editingLeaveId = null;
    this.leaveValidationErrors = [];
    this.showLeaveModal = true;
  }
  
  editLeaveRequest(leave: LeaveRequest): void {
    if (leave.statuts !== 'PENDING') {
      this.showNotificationMessage('Seules les demandes en attente peuvent être modifiées', 'error');
      return;
    }
    
    this.newLeave = {
      type: leave.type,
      start_date: this.formatDateForInput(leave.start_date),
      end_date: this.formatDateForInput(leave.end_date),
      reason: leave.reason
    };
    this.editingLeaveId = leave.id;
    this.showLeaveModal = true;
  }
  
  closeLeaveModal(): void {
    this.showLeaveModal = false;
    this.editingLeaveId = null;
  }
  
  closeModal(event: MouseEvent): void {
    if ((event.target as HTMLElement).classList.contains('modal')) {
      this.closeLeaveModal();
    }
  }
  
  submitLeaveRequest(): void {
    if (!this.validateLeaveForm()) return;
    
    this.isLoading = true;
    const leaveData = {
      type: this.newLeave.type,
      start_date: this.newLeave.start_date,
      end_date: this.newLeave.end_date,
      reason: this.newLeave.reason || ''
    };
    
    const request$ = this.editingLeaveId 
      ? this.apiService.updateLeaveRequest(this.editingLeaveId, leaveData)
      : this.apiService.createLeaveRequest(leaveData);
    
    request$.subscribe({
      next: (response: any) => {
        if (this.editingLeaveId) {
          const index = this.leaveRequests.findIndex(r => r.id === this.editingLeaveId);
          if (index !== -1) {
            this.leaveRequests[index] = { ...this.leaveRequests[index], ...response.data };
          }
        } else {
          this.leaveRequests.unshift(response.data);
        }
        this.pendingRequests = this.leaveRequests.filter(r => r.statuts === 'PENDING').length;
        this.showNotificationMessage(
          this.editingLeaveId ? 'Demande modifiée avec succès' : 'Demande de congé envoyée avec succès', 
          'success'
        );
        this.closeLeaveModal();
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.showNotificationMessage('Erreur lors de l\'envoi de la demande', 'error');
        this.isLoading = false;
      }
    });
  }
  
  private validateLeaveForm(): boolean {
    this.leaveValidationErrors = [];
    
    if (!this.newLeave.start_date) {
      this.leaveValidationErrors.push('La date de début est requise');
    }
    if (!this.newLeave.end_date) {
      this.leaveValidationErrors.push('La date de fin est requise');
    }
    if (!this.newLeave.reason) {
      this.leaveValidationErrors.push('La raison est requise');
    }
    
    if (this.newLeave.start_date && this.newLeave.end_date) {
      const startDate = new Date(this.newLeave.start_date);
      const endDate = new Date(this.newLeave.end_date);
      const today = new Date(); 
      today.setHours(0, 0, 0, 0);
      
      if (startDate > endDate) {
        this.leaveValidationErrors.push('La date de début doit être antérieure à la date de fin');
      }
      if (startDate < today) {
        this.leaveValidationErrors.push('La date de début ne peut pas être dans le passé');
      }
    }
    
    return this.leaveValidationErrors.length === 0;
  }
  
  canSubmitLeave(): boolean {
    return !!this.newLeave.start_date && !!this.newLeave.end_date && !!this.newLeave.reason;
  }
  
  openDeleteModal(id: number, leave: LeaveRequest): void {
    this.deleteRequestId = id;
    this.deleteRequestTitle = `${leave.type} du ${this.formatDate(leave.start_date)} au ${this.formatDate(leave.end_date)}`;
    this.showDeleteModal = true;
  }
  
  confirmDelete(): void {
    if (!this.deleteRequestId) return;
    
    this.isLoading = true;
    this.showDeleteModal = false;
    
    this.apiService.deleteLeaveRequest(this.deleteRequestId).subscribe({
      next: () => {
        this.leaveRequests = this.leaveRequests.filter(r => r.id !== this.deleteRequestId);
        this.pendingRequests = this.leaveRequests.filter(r => r.statuts === 'PENDING').length;
        this.showNotificationMessage('Demande supprimée avec succès', 'success');
        this.isLoading = false;
        this.deleteRequestId = null;
        this.cdr.detectChanges();
      },
      error: () => {
        this.showNotificationMessage('Erreur lors de la suppression', 'error');
        this.isLoading = false;
        this.deleteRequestId = null;
      }
    });
  }
  
  cancelDelete(): void {
    this.showDeleteModal = false;
    this.deleteRequestId = null;
    this.deleteRequestTitle = '';
  }
  
  getLeaveStatusLabel(status: string): string {
    const labels: Record<string, string> = { 
      'PENDING': 'En attente', 
      'APPROVED': 'Approuvé', 
      'REJECTED': 'Refusé', 
      'CANCELLED': 'Annulé' 
    };
    return labels[status] || status;
  }
  
  /**
   * Retourne le libellé du type de congé
   */
  getLeaveTypeLabel(type: string): string {
    const labels: Record<string, string> = {
      'ANNUAL': 'Congés annuels',
      'SICK': 'Congés maladie',
      'PERSONAL': 'Congés personnels',
      'UNPAID': 'Congés sans solde',
      'MATERNITY': 'Congé maternité',
      'OTHER': 'Autre'
    };
    return labels[type] || type;
  }
  
  // ============================================
  // STATS METHODS
  // ============================================
  
  private loadWeeklyStats(): void {
    if (!this.apiService.isAuthenticated()) {
      this.setMockWeeklyStats();
      return;
    }
    
    this.apiService.getWeeklyStats().subscribe({
      next: (response) => {
        if (response?.success) {
          const data = response.data;
          this.weeklyData.datasets[0].data = [
            data.daily?.monday || 0,
            data.daily?.tuesday || 0,
            data.daily?.wednesday || 0,
            data.daily?.thursday || 0,
            data.daily?.friday || 0,
            data.daily?.saturday || 0
          ];
          this.weeklyData = { ...this.weeklyData };
          this.cdr.detectChanges();
        }
      },
      error: () => {
        this.setMockWeeklyStats();
      }
    });
  }
  
  private setMockWeeklyStats(): void {
    this.weeklyData.datasets[0].data = [7.5, 8, 6.5, 8.5, 7, 0];
    this.weeklyData = { ...this.weeklyData };
    this.cdr.detectChanges();
  }
  
  private loadTodayActivityStats(): void {
    this.apiService.getTodayActivityStats().subscribe({
      next: (response: ActivityStats) => {
        if (response) {
          this.todayMouseClicks = response.total_mouse_clicks || 0;
          this.todayKeyboardClicks = response.total_keyboard_clicks || 0;
          this.todayActivityLevel = response.avg_activity_level || 0;
          this.todayActivityLogsCount = response.logs_count || 0;
          this.activityTrend = response.trend || 0;
          this.cdr.detectChanges();
        }
      },
      error: (err) => {
        console.warn('⚠️ Erreur chargement stats activité:', err);
        // Valeurs par défaut
        this.todayMouseClicks = 0;
        this.todayKeyboardClicks = 0;
        this.todayActivityLevel = 50;
        this.todayActivityLogsCount = 0;
        this.activityTrend = 0;
        this.cdr.detectChanges();
      }
    });
  }
  
  // ============================================
  // ACTIVITY TRACKING
  // ============================================
  
  private initActivityTracking(): void {
    console.log('🖱️ Démarrage du tracking d\'activité');
    this.lastActivityTime = Date.now();
    this.setupActivityListeners();
    this.startPeriodicSend();
    this.startInactivityChecker();
  }
  
  private setupActivityListeners(): void {
    const activityHandler = () => this.onUserActivity();
    const events = ['mousemove', 'click', 'keypress', 'scroll'];
    
    events.forEach(event => {
      window.addEventListener(event, activityHandler);
      this.activityListeners.set(event, activityHandler);
    });
  }
  
  private onUserActivity(): void {
    const now = Date.now();
    this.lastActivityTime = now;
    
    if (!this.isUserActive) {
      this.isUserActive = true;
      console.log('🟢 Utilisateur réactivé');
      this.cdr.detectChanges();
    }
    
    this.mouseClicks++;
    this.todayMouseClicks++;
    this.cdr.detectChanges();
  }
  
  private startInactivityChecker(): void {
    this.inactivityCheckInterval = setInterval(() => {
      const minutesSinceLastActivity = (Date.now() - this.lastActivityTime) / 60000;
      this.inactiveDisplayMinutes = Math.floor(minutesSinceLastActivity);
      
      if (minutesSinceLastActivity >= this.INACTIVITY_THRESHOLD) {
        this.currentActivityLevel = 0;
        if (this.isUserActive) {
          this.isUserActive = false;
          console.log(`🔴 Inactivité prolongée: ${minutesSinceLastActivity.toFixed(1)} minutes`);
          this.cdr.detectChanges();
        }
      } else {
        const activityPercent = 100 - (minutesSinceLastActivity / this.INACTIVITY_THRESHOLD) * 100;
        this.currentActivityLevel = Math.max(0, Math.min(100, Math.round(activityPercent)));
      }
      
      this.todayActivityLevel = this.currentActivityLevel;
      this.cdr.detectChanges();
    }, 10000);
  }
  
  private startPeriodicSend(): void {
    this.activityInterval = setInterval(() => {
      if (this.isCheckedIn && !this.isCheckedOut) {
        this.apiService.sendActivityLog({
          keyboard_clicks: this.keyboardClicks,
          mouse_clicks: this.mouseClicks,
          activity_level: this.currentActivityLevel
        }).subscribe({
          next: () => {
            this.keyboardClicks = 0;
            this.mouseClicks = 0;
            this.cdr.detectChanges();
          },
          error: (err) => {
            console.error('❌ Erreur envoi log:', err);
          }
        });
      } else {
        this.keyboardClicks = 0;
        this.mouseClicks = 0;
      }
    }, this.SEND_INTERVAL);
  }
  
  private stopActivityTracking(): void {
    if (this.activityInterval) {
      clearInterval(this.activityInterval);
      this.activityInterval = null;
    }
    if (this.inactivityCheckInterval) {
      clearInterval(this.inactivityCheckInterval);
      this.inactivityCheckInterval = null;
    }
    
    this.activityListeners.forEach((handler, event) => {
      window.removeEventListener(event, handler);
    });
    this.activityListeners.clear();
    
    console.log('🛑 Tracking d\'activité arrêté');
  }
  
  // ============================================
  // SCREENSHOTS
  // ============================================
  
  private startAutoScreenshots(): void {
    console.log('📸 Démarrage des captures automatiques toutes les 10 minutes');
    this.screenshotInterval = setInterval(() => {
      if (this.isCheckedIn && !this.isCheckedOut) {
        this.captureScreenshot();
      }
    }, this.SCREENSHOT_INTERVAL);
  }
  
  async captureScreenshot(): Promise<void> {
    try {
      console.log('📸 Capture d\'écran en cours...');
      const html2canvasModule = await import('html2canvas');
      const canvas = await html2canvasModule.default(document.body, {
        scale: 0.5,
        logging: false,
        useCORS: true,
        backgroundColor: '#ffffff'
      });
      
      this.apiService.captureAndCompare(canvas.toDataURL('image/png'), null).subscribe({
        next: (response: any) => {
          if (response?.success) {
            const msg = response.message || 'Capture sauvegardée avec succès';
            console.log(`✅ ${msg}`);
            if (response.is_identical) {
              console.log(`📊 Similarité: ${response.similarity_score}%`);
            }
          }
        },
        error: (err) => {
          console.error('❌ Erreur envoi capture:', err);
        }
      });
    } catch (error) {
      console.error('❌ Erreur capture écran:', error);
    }
  }
  
  // ============================================
  // AI SCORE
  // ============================================
  
  calculateAIScore(): void {
    this.isCalculatingScore = true;
    this.cdr.detectChanges();
    
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 7);
    
    const startDateStr = startDate.toISOString().split('T')[0];
    const endDateStr = endDate.toISOString().split('T')[0];
    
    console.log(`🤖 Calcul du score IA pour la période: ${startDateStr} → ${endDateStr}`);
    
    this.apiService.exportForAI(startDateStr, endDateStr).subscribe({
      next: (response: any) => {
        if (response?.success) {
          this.aiScoreService.calculateScore(response.data).subscribe({
            next: (result: ProductivityResponse) => {
              this.aiScore = result.score;
              this.aiLevel = result.level;
              this.aiLevelIcon = result.level_icon;
              this.aiLevelColor = result.level_color;
              this.aiRecommendations = result.recommendations || [];
              this.aiRecommendationsDetailed = result.recommendations_detailed || [];
              this.aiPenalties = result.details?.penalties || [];
              this.aiBonuses = result.details?.bonuses || [];
              this.isCalculatingScore = false;
              this.cdr.detectChanges();
              console.log(`🤖 Score IA: ${this.aiScore}% - ${this.aiLevel}`);
            },
            error: (err) => { 
              console.error('❌ Erreur calcul IA:', err);
              this.isCalculatingScore = false; 
              this.cdr.detectChanges(); 
            }
          });
        } else {
          this.isCalculatingScore = false;
          this.cdr.detectChanges();
        }
      },
      error: (err) => { 
        console.error('❌ Erreur export données:', err);
        this.isCalculatingScore = false; 
        this.cdr.detectChanges(); 
      }
    });
  }
  
  // ============================================
  // UTILITIES
  // ============================================
  
  refreshData(): void {
    console.log('🔄 Rafraîchissement des données');
    this.isLoading = true;
    this.cdr.detectChanges();
    
    this.loadTodayAttendance();
    this.loadTasks();
    this.loadLeaveRequests();
    this.loadWeeklyStats();
    this.loadTodayActivityStats();
    this.calculateAIScore();
    
    setTimeout(() => {
      this.showNotificationMessage('Données rafraîchies!', 'success');
      this.isLoading = false;
      this.cdr.detectChanges();
    }, 1000);
  }
  
  private showNotificationMessage(message: string, type: 'success' | 'error' = 'success'): void {
    this.notification = { 
      message, 
      type, 
      icon: type === 'success' ? '✅' : '❌' 
    };
    this.showNotification = true;
    this.cdr.detectChanges();
    
    setTimeout(() => {
      this.showNotification = false;
      this.notification = null;
      this.cdr.detectChanges();
    }, 3000);
  }
}