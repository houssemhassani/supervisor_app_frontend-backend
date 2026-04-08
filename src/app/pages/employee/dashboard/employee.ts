import { Component, OnInit, OnDestroy, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClientModule } from '@angular/common/http';
import { Chart, ChartConfiguration, registerables } from 'chart.js';
import { BaseChartDirective } from 'ng2-charts';
import { interval, Subscription, catchError, of, finalize } from 'rxjs';
import { AuthService } from '../../../core/services/AuthService/auth';
import { EmployeeApiService } from "../../../services/employee";
import { AiScoreService } from '../../../services/ai-score';

Chart.register(...registerables);

@Component({
  selector: 'app-employee-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, HttpClientModule, BaseChartDirective],
  templateUrl: './employee.html',
  styleUrls: ['./employee.scss']
})
export class EmployeeDashboardComponent implements OnInit, OnDestroy {
  currentDate = new Date();
  isLoading = false;
  showNotification = false;
  notificationMessage = '';
  notificationType = 'success';
  notificationIcon = '✅';
  
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
  productivityScore = 85;
  attendanceId: number | null = null;
  timeLogId: number | null = null;
  activeBreakId: number | null = null;
  
  // Status display
  currentStatus: string = '📅 Non pointé';
  currentStatusClass: string = 'status-not-checked';
  attendanceStatus: string = '';
  
  // Tasks
  tasks: any[] = [];
  filteredTasks: any[] = [];
  taskFilter = 'all';
  tasksCompleted = 0;
  totalTasks = 0;
  
  // Leave
  leaveRequests: any[] = [];
  leaveBalance = 15;
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
  deleteRequestType: string = '';
  
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
        labels: {
          color: '#333',
          font: { size: 12 }
        }
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
        grid: {
          color: '#e0e0e0'
        },
        title: {
          display: true,
          text: 'Heures',
          color: '#666'
        }
      },
      x: {
        grid: {
          display: false
        },
        ticks: {
          color: '#666'
        }
      }
    }
  };
  
  private breakInterval: any;
  private refreshSubscription?: Subscription;
  private tasksSubscription?: Subscription;
  
  // ========== ACTIVITY TRACKING ==========
  private activityInterval: any;
  private keyboardClicks = 0;
  private mouseClicks = 0;
  private currentActivityLevel = 100;
  public inactiveDisplayMinutes: number = 0;
  public isUserActive: boolean = true;
  private lastActivityTime = Date.now();
  private readonly INACTIVITY_THRESHOLD = 15; // 15 minutes
  private readonly SEND_INTERVAL = 60000; // 1 minute
  private inactivityCheckInterval: any;
  private activityListeners: Map<string, () => void> = new Map();
  
  // Activity stats for template
  public todayMouseClicks: number = 0;
  public todayKeyboardClicks: number = 0;
  public todayActivityLevel: number = 0;
  public todayActivityLogsCount: number = 0;
  
  // ========== SCREENSHOTS ==========
  private screenshotInterval: any;
  private readonly SCREENSHOT_INTERVAL = 600000; // 10 minutes (600000 ms)
  
  // ========== AI SCORE ==========
  public aiScore: number = 0;
  public aiLevel: string = '';
  public aiRecommendations: string[] = [];
  public isCalculatingScore: boolean = false;
  
  constructor(
    private apiService: EmployeeApiService,
    private authService: AuthService,
    private aiScoreService: AiScoreService
  ) {}
  
  ngOnInit(): void {
    console.log('🚀 ngOnInit - Initialisation du dashboard');
    this.loadUserData();
    this.loadTodayAttendance();
    this.loadTasks();
    this.loadLeaveRequests();
    this.loadWeeklyStats();
    this.loadTodayActivityStats();
    
    // Démarrer le tracking d'activité
    this.initActivityTracking();
    
    // Démarrer les captures automatiques
    this.startAutoScreenshots();
    
    // Calculer le score IA
    this.calculateAIScore();
    
    this.refreshSubscription = interval(60000).subscribe(() => {
      console.log('🔄 Auto-refresh des données...');
      this.refreshData();
    });
  }
  
  ngOnDestroy(): void {
    if (this.refreshSubscription) {
      this.refreshSubscription.unsubscribe();
    }
    if (this.tasksSubscription) {
      this.tasksSubscription.unsubscribe();
    }
    if (this.breakInterval) {
      clearInterval(this.breakInterval);
    }
    if (this.screenshotInterval) {
      clearInterval(this.screenshotInterval);
    }
    
    // Arrêter le tracking d'activité
    this.stopActivityTracking();
  }
  
  private isAuthenticated(): boolean {
    return this.authService.isAuthenticated();
  }
  
  loadUserData(): void {
    const currentUser = this.authService.getCurrentUser();
    
    if (currentUser) {
      this.user = {
        id: currentUser.id,
        username: currentUser.username,
        email: currentUser.email,
        role: currentUser.role?.name?.toUpperCase() || 'EMPLOYEE',
        department: currentUser.department,
        position: currentUser.position
      };
      console.log('✅ Utilisateur chargé:', this.user);
    } else {
      this.user = {
        username: 'Employé',
        email: 'employe@test.com',
        role: 'EMPLOYEE',
        id: 1
      };
    }
  }
  
  // ========== FORMATAGE DES DATES ==========
  
  formatDate(dateString: string): string {
    if (!dateString) return '';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('fr-FR', {
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
    const date = new Date(dateString);
    return date.toISOString().split('T')[0];
  }
  
  formatDateTime(date: Date | string | null): string {
    if (!date) return '';
    try {
      const d = new Date(date);
      return d.toLocaleString('fr-FR', {
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
  
  formatTime(date: Date | null): string {
    if (!date) return '';
    return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  }
  
  // ========== ATTENDANCE ==========
  
  loadTodayAttendance(): void {
    console.log('🔄 [loadTodayAttendance] Début');
    
    if (!this.apiService.isAuthenticated()) {
      console.warn('⚠️ Non authentifié, chargement mock');
      this.loadMockAttendance();
      return;
    }
    
    this.apiService.getTodayDashboard().subscribe({
      next: (response) => {
        console.log('✅ [loadTodayAttendance] Réponse reçue:', response);
        if (response && response.success) {
          const data = response.data;
          this.isCheckedIn = !!data.attendance?.checkIn;
          this.isCheckedOut = !!data.attendance?.checkOut;
          this.isOnBreak = !!data.currentSession?.isOnBreak;
          this.workHoursToday = data.attendance?.workHours || 0;
          this.breakHoursToday = data.attendance?.breakHours || 0;
          this.startTime = data.attendance?.checkIn ? new Date(data.attendance.checkIn) : null;
          this.attendanceId = data.attendance?.id || null;
          this.attendanceStatus = data.attendance?.status || 'ABSENT';
          
          this.updateStatusDisplay(this.attendanceStatus);
          
          console.log('📅 État:', { 
            isCheckedIn: this.isCheckedIn, 
            isCheckedOut: this.isCheckedOut,
            status: this.attendanceStatus
          });
        }
      },
      error: (error) => {
        console.error('❌ [loadTodayAttendance] Erreur:', error);
        this.loadMockAttendance();
      }
    });
  }
  
  loadMockAttendance(): void {
    this.isCheckedIn = false;
    this.isCheckedOut = false;
    this.isOnBreak = false;
    this.workHoursToday = 0;
    this.breakHoursToday = 0;
    this.attendanceStatus = 'ABSENT';
    this.updateStatusDisplay('ABSENT');
  }
  
  checkIn(): void {
    if (this.isCheckedIn) {
      this.showNotificationMessage('Vous avez déjà pointé aujourd\'hui', 'error');
      return;
    }
    
    if (!this.isAuthenticated()) {
      this.showNotificationMessage('Veuillez vous connecter d\'abord', 'error');
      return;
    }
    
    this.isLoading = true;
    
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const locationData = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude
          };
          this.sendCheckIn(locationData);
        },
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
        console.error('❌ Erreur check-in:', error);
        let errorMessage = 'Erreur lors du check-in';
        if (error.status === 401) {
          errorMessage = 'Session expirée. Veuillez vous reconnecter.';
        } else if (error.error?.message) {
          errorMessage = error.error.message;
        }
        this.showNotificationMessage(errorMessage, 'error');
        return of(null);
      }),
      finalize(() => {
        this.isLoading = false;
      })
    ).subscribe((response: any) => {
      if (response && response.success) {
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
    
    if (!this.isAuthenticated()) {
      this.showNotificationMessage('Veuillez vous connecter d\'abord', 'error');
      return;
    }
    
    this.isLoading = true;
    
    this.apiService.checkOut().pipe(
      catchError((error) => {
        console.error('❌ Erreur check-out:', error);
        this.showNotificationMessage('Erreur lors du check-out', 'error');
        return of(null);
      }),
      finalize(() => {
        this.isLoading = false;
      })
    ).subscribe((response: any) => {
      if (response && response.success) {
        this.isCheckedOut = true;
        this.isCheckedIn = false;
        this.isOnBreak = false;
        this.attendanceStatus = response.data?.status || 'PRESENT';
        
        if (this.breakInterval) {
          clearInterval(this.breakInterval);
        }
        
        const workHours = response.data?.workHours || 0;
        this.updateStatusDisplay(this.attendanceStatus);
        
        let statusMessage = '';
        let notificationType: 'success' | 'error' = 'success';
        
        switch(this.attendanceStatus) {
          case 'ABSENT':
            statusMessage = '⚠️ Attention: Moins de 7h travaillées';
            notificationType = 'error';
            break;
          case 'PARTIAL':
            statusMessage = '⚠️ Journée incomplète (moins de 8h)';
            notificationType = 'error';
            break;
          default:
            statusMessage = '✅ Journée complète';
            notificationType = 'success';
        }
        
        this.showNotificationMessage(
          `Check-out effectué. ${workHours.toFixed(2)} heures travaillées. ${statusMessage}`, 
          notificationType
        );
        
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
    
    if (!this.isAuthenticated()) {
      this.showNotificationMessage('Veuillez vous connecter d\'abord', 'error');
      return;
    }
    
    this.isLoading = true;
    
    this.apiService.startBreak({ type: 'SHORT' }).pipe(
      catchError((error) => {
        console.error('❌ Erreur début pause:', error);
        let errorMessage = 'Erreur lors du début de pause';
        if (error.error?.message) {
          errorMessage = error.error.message;
        }
        this.showNotificationMessage(errorMessage, 'error');
        return of(null);
      }),
      finalize(() => {
        this.isLoading = false;
      })
    ).subscribe((response: any) => {
      if (response && response.success) {
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
          }
        }, 60000);
        this.loadTodayAttendance();
      }
    });
  }
  
  endBreak(): void {
    console.log('🟢 endBreak() appelée');
    if (!this.isOnBreak) {
      this.showNotificationMessage('Vous n\'êtes pas en pause', 'error');
      return;
    }
    
    this.isLoading = true;
    
    this.apiService.endBreak().subscribe({
      next: (response) => {
        console.log('✅ endBreak réponse:', response);
        if (response.success) {
          this.isOnBreak = false;
          this.activeBreakId = null;
          if (this.breakInterval) {
            clearInterval(this.breakInterval);
          }
          const duration = response.data?.durationMinutes || this.breakDuration;
          this.showNotificationMessage(`Pause terminée après ${duration} minutes`, 'success');
          this.loadTodayAttendance();
        }
        this.isLoading = false;
      },
      error: (error) => {
        console.error('❌ endBreak erreur:', error);
        this.showNotificationMessage('Erreur lors de la fin de pause', 'error');
        this.isLoading = false;
      }
    });
  }
  
  // ========== STATISTIQUES ==========
  
  loadMockWeeklyStats(): void {
    this.weeklyData.datasets[0].data = [7.5, 8, 6.5, 8.5, 7, 0];
    this.weeklyData = { ...this.weeklyData };
  }
  
  // ========== TÂCHES ==========
  
  loadTasks(): void {
    if (this.tasksSubscription) {
      this.tasksSubscription.unsubscribe();
    }
    
    if (!this.isAuthenticated()) {
      this.loadMockTasks();
      return;
    }
    
    const userId = this.user?.id || 1;
    console.log('🔄 [loadTasks] Chargement des tâches pour userId:', userId);
    
    this.tasksSubscription = this.apiService.getTasks(userId).subscribe({
      next: (response: any) => {
        console.log('✅ [loadTasks] Réponse reçue:', response);
        
        let rawTasks: any[] = [];
        
        if (response?.data) {
          if (Array.isArray(response.data)) {
            rawTasks = response.data;
          } else if (response.data.data && Array.isArray(response.data.data)) {
            rawTasks = response.data.data;
          } else if (response.data.attributes) {
            rawTasks = [response.data];
          }
        }
        
        const uniqueTasksMap = new Map<number, any>();
        rawTasks.forEach(task => {
          if (task && task.id && !uniqueTasksMap.has(task.id)) {
            uniqueTasksMap.set(task.id, task);
          }
        });
        
        const uniqueTasks = Array.from(uniqueTasksMap.values());
        
        this.tasks = uniqueTasks.filter((task: any) => {
          const assignedTo = task.assigned_to;
          if (!assignedTo) return false;
          
          if (typeof assignedTo === 'object') {
            return assignedTo.id === userId;
          }
          if (typeof assignedTo === 'number') {
            return assignedTo === userId;
          }
          return false;
        });
        
        this.tasks.sort((a, b) => {
          if (a.due_date && b.due_date) {
            return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
          }
          return 0;
        });
        
        this.filterTasks();
        this.updateTaskStats();
      },
      error: (error) => {
        console.error('❌ Erreur chargement tâches:', error);
        this.loadMockTasks();
      }
    });
  }
  
  loadMockTasks(): void {
    this.tasks = [
      { id: 1, title: 'Développer le dashboard employé', description: 'Créer l\'interface utilisateur', priority: 'HIGH', statuts: 'IN_PROGRESS', due_date: '2026-04-15' },
      { id: 2, title: 'Rédiger la documentation', description: 'Documenter les fonctionnalités', priority: 'MEDIUM', statuts: 'TODO', due_date: '2026-04-20' },
      { id: 3, title: 'Tester les fonctionnalités', description: 'Effectuer les tests unitaires', priority: 'LOW', statuts: 'DONE', due_date: '2026-03-30' }
    ];
    this.filterTasks();
    this.updateTaskStats();
  }
  
  filterTasks(): void {
    if (this.taskFilter === 'all') {
      this.filteredTasks = [...this.tasks];
    } else {
      this.filteredTasks = this.tasks.filter(task => task.statuts === this.taskFilter);
    }
  }
  
  updateTaskStats(): void {
    this.totalTasks = this.tasks.length;
    this.tasksCompleted = this.tasks.filter(t => t.statuts === 'DONE').length;
    this.productivityScore = this.totalTasks > 0 ? Math.round((this.tasksCompleted / this.totalTasks) * 100) : 85;
  }
  
  updateTaskStatus(task: any): void {
    if (task.statuts === 'DONE') {
      this.showNotificationMessage('Cette tâche est déjà terminée', 'error');
      return;
    }
    
    if (!this.isAuthenticated()) {
      this.showNotificationMessage('Veuillez vous connecter', 'error');
      return;
    }
    
    this.apiService.updateTaskStatus(task.id, 'DONE').pipe(
      catchError((error) => {
        console.error('❌ Erreur mise à jour tâche:', error);
        this.showNotificationMessage('Erreur lors de la mise à jour', 'error');
        return of(null);
      })
    ).subscribe(() => {
      task.statuts = 'DONE';
      this.updateTaskStats();
      this.showNotificationMessage('Tâche marquée comme terminée!', 'success');
    });
  }
  
  // ========== CONGÉS ==========
  
  loadLeaveRequests(): void {
    if (!this.isAuthenticated()) {
      this.loadMockLeaveRequests();
      return;
    }
    
    this.apiService.getLeaveRequests().subscribe({
      next: (response) => {
        if (response && response.data) {
          this.leaveRequests = response.data;
          this.pendingRequests = this.leaveRequests.filter(r => r.statuts === 'PENDING').length;
        }
      },
      error: (error) => {
        if (error.status !== 401) {
          console.error('❌ Erreur chargement congés:', error);
        }
        this.loadMockLeaveRequests();
      }
    });
  }
  
  loadWeeklyStats(): void {
    if (!this.isAuthenticated()) {
      this.loadMockWeeklyStats();
      return;
    }
    
    this.apiService.getWeeklyStats().subscribe({
      next: (response) => {
        if (response && response.success) {
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
        }
      },
      error: (error) => {
        if (error.status !== 401) {
          console.error('❌ Erreur chargement stats:', error);
        }
        this.loadMockWeeklyStats();
      }
    });
  }
  
  loadTodayActivityStats(): void {
    this.apiService.getTodayActivityStats().subscribe({
      next: (response: any) => {
        if (response && response.success) {
          this.todayMouseClicks = response.data.total_mouse_clicks || 0;
          this.todayKeyboardClicks = response.data.total_keyboard_clicks || 0;
          this.todayActivityLevel = response.data.avg_activity_level || 0;
          this.todayActivityLogsCount = response.data.logs_count || 0;
          console.log('📊 Stats activité chargées:', {
            souris: this.todayMouseClicks,
            clavier: this.todayKeyboardClicks,
            niveau: this.todayActivityLevel,
            logs: this.todayActivityLogsCount
          });
        }
      },
      error: (err: any) => console.error('Erreur chargement stats activité:', err)
    });
  }
  
  loadMockLeaveRequests(): void {
    this.leaveRequests = [
      { id: 1, type: 'ANNUAL', start_date: '2026-04-10', end_date: '2026-04-15', reason: 'Vacances de printemps', statuts: 'PENDING' }
    ];
    this.pendingRequests = this.leaveRequests.filter(r => r.statuts === 'PENDING').length;
  }
  
  editLeaveRequest(leave: any): void {
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
  
  openDeleteModal(id: number, leave: any): void {
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
      },
      error: (error: any) => {
        console.error('❌ Erreur suppression:', error);
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
  
  submitLeaveRequest(): void {
    if (!this.validateLeaveForm()) return;

    this.isLoading = true;

    const leaveData = {
      type: this.newLeave.type,
      start_date: this.newLeave.start_date,
      end_date: this.newLeave.end_date,
      reason: this.newLeave.reason || ''
    };

    if (this.editingLeaveId) {
      this.apiService.updateLeaveRequest(this.editingLeaveId, leaveData).subscribe({
        next: (response: any) => {
          const index = this.leaveRequests.findIndex(r => r.id === this.editingLeaveId);
          if (index !== -1) {
            this.leaveRequests[index] = { ...this.leaveRequests[index], ...response.data };
          }
          this.pendingRequests = this.leaveRequests.filter(r => r.statuts === 'PENDING').length;
          this.showNotificationMessage('Demande modifiée avec succès', 'success');
          this.closeLeaveModal();
          this.isLoading = false;
        },
        error: (error: any) => {
          console.error('❌ Erreur modification:', error);
          this.showNotificationMessage('Erreur lors de la modification', 'error');
          this.isLoading = false;
        }
      });
    } else {
      this.apiService.createLeaveRequest(leaveData).subscribe({
        next: (response: any) => {
          this.leaveRequests.unshift(response.data);
          this.pendingRequests++;
          this.showNotificationMessage('Demande de congé envoyée avec succès', 'success');
          this.closeLeaveModal();
          this.isLoading = false;
        },
        error: (error: any) => {
          console.error('❌ Erreur:', error);
          this.showNotificationMessage('Erreur lors de l\'envoi de la demande', 'error');
          this.isLoading = false;
        }
      });
    }
  }
  
  validateLeaveForm(): boolean {
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
    return this.newLeave.start_date !== '' && 
           this.newLeave.end_date !== '' && 
           this.newLeave.reason !== '';
  }
  
  openLeaveModal(): void {
    this.newLeave = {
      type: 'ANNUAL',
      start_date: '',
      end_date: '',
      reason: ''
    };
    this.editingLeaveId = null;
    this.leaveValidationErrors = [];
    this.showLeaveModal = true;
  }
  
  closeLeaveModal(): void {
    this.showLeaveModal = false;
    this.editingLeaveId = null;
    this.newLeave = {
      type: 'ANNUAL',
      start_date: '',
      end_date: '',
      reason: ''
    };
  }
  
  closeModal(event: MouseEvent): void {
    if ((event.target as HTMLElement).classList.contains('modal')) {
      this.closeLeaveModal();
    }
  }
  
  refreshData(): void {
    console.log('🔄 RefreshData - Rafraîchissement des données');
    this.isLoading = true;
    this.loadTodayAttendance();
    this.loadTasks();
    this.loadLeaveRequests();
    this.loadWeeklyStats();
    this.loadTodayActivityStats();
    setTimeout(() => {
      this.showNotificationMessage('Données rafraîchies!', 'success');
      this.isLoading = false;
    }, 500);
  }
  
  updateStatusDisplay(status: string): void {
    let statusText = '';
    let statusClass = '';
    
    switch(status) {
      case 'PRESENT':
        statusText = '✅ Présent';
        statusClass = 'status-present';
        break;
      case 'LATE':
        statusText = '⚠️ En retard';
        statusClass = 'status-late';
        break;
      case 'PARTIAL':
        statusText = '⏳ Journée incomplète';
        statusClass = 'status-partial';
        break;
      case 'ABSENT':
        statusText = '❌ Absent';
        statusClass = 'status-absent';
        break;
      default:
        statusText = '📅 Non pointé';
        statusClass = 'status-not-checked';
    }
    
    this.currentStatus = statusText;
    this.currentStatusClass = statusClass;
  }
  
  getStatusLabel(status: string): string {
    const labels: any = {
      'TODO': 'À faire',
      'IN_PROGRESS': 'En cours',
      'DONE': 'Terminé'
    };
    return labels[status] || status;
  }
  
  getLeaveStatusLabel(status: string): string {
    const labels: any = {
      'PENDING': 'En attente',
      'APPROVED': 'Approuvé',
      'REJECTED': 'Refusé',
      'CANCELLED': 'Annulé'
    };
    return labels[status] || status;
  }
  
  showNotificationMessage(message: string, type: 'success' | 'error' = 'success'): void {
    this.notificationMessage = message;
    this.notificationType = type;
    this.notificationIcon = type === 'success' ? '✅' : '❌';
    this.showNotification = true;
    
    setTimeout(() => {
      this.showNotification = false;
    }, 3000);
  }

  // ========== ACTIVITY TRACKING METHODS ==========

  initActivityTracking(): void {
    console.log('🖱️ Démarrage du tracking d\'activité');
    
    this.lastActivityTime = Date.now();
    this.setupActivityListeners();
    this.startPeriodicSend();
    this.startInactivityChecker();
  }

  private setupActivityListeners(): void {
    const activityHandler = () => this.onUserActivity();
    
    window.addEventListener('mousemove', activityHandler);
    window.addEventListener('click', activityHandler);
    window.addEventListener('keypress', activityHandler);
    window.addEventListener('scroll', activityHandler);
    
    this.activityListeners.set('mousemove', activityHandler);
    this.activityListeners.set('click', activityHandler);
    this.activityListeners.set('keypress', activityHandler);
    this.activityListeners.set('scroll', activityHandler);
  }

  private onUserActivity(): void {
    const now = Date.now();
    
    this.lastActivityTime = now;
    
    if (!this.isUserActive) {
      this.isUserActive = true;
      console.log(`🟢 Utilisateur réactivé`);
    }
    
    this.mouseClicks++;
    this.todayMouseClicks++;
  }

  private startInactivityChecker(): void {
    this.inactivityCheckInterval = setInterval(() => {
      const now = Date.now();
      const minutesSinceLastActivity = (now - this.lastActivityTime) / 1000 / 60;
      const roundedMinutes = Math.round(minutesSinceLastActivity * 10) / 10;
      
      this.inactiveDisplayMinutes = Math.floor(minutesSinceLastActivity);
      
      if (minutesSinceLastActivity >= this.INACTIVITY_THRESHOLD) {
        this.currentActivityLevel = 0;
        if (this.isUserActive) {
          this.isUserActive = false;
          console.log(`🔴 DÉTECTION D'INACTIVITÉ PROLONGÉE: ${roundedMinutes} minutes sans activité`);
        }
      } else {
        const activityPercent = 100 - (minutesSinceLastActivity / this.INACTIVITY_THRESHOLD) * 100;
        this.currentActivityLevel = Math.max(0, Math.min(100, Math.round(activityPercent)));
      }
      
      if (minutesSinceLastActivity > 10 && minutesSinceLastActivity < 15 && this.isUserActive) {
        console.log(`⚠️ Attention: ${roundedMinutes} minutes d'inactivité, bientôt détection...`);
      }
      
    }, 10000);
  }

  private startPeriodicSend(): void {
    this.activityInterval = setInterval(() => {
      if (this.isCheckedIn && !this.isCheckedOut) {
        
        console.log(`📊 [ACTIVITY] Envoi log - Souris: ${this.mouseClicks}, Clavier: ${this.keyboardClicks}, Niveau: ${this.currentActivityLevel}%, Inactif: ${!this.isUserActive}`);
        
        this.apiService.sendActivityLog({
          keyboard_clicks: this.keyboardClicks,
          mouse_clicks: this.mouseClicks,
          activity_level: this.currentActivityLevel,
          projectId: undefined
        }).subscribe({
          next: () => {
            this.keyboardClicks = 0;
            this.mouseClicks = 0;
          },
          error: (err: any) => console.error('❌ Erreur envoi log:', err)
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

  // ========== SCREENSHOTS METHODS ==========

  startAutoScreenshots(): void {
    console.log('📸 Démarrage des captures automatiques toutes les 10 minutes');
    this.screenshotInterval = setInterval(() => {
      if (this.isCheckedIn && !this.isCheckedOut) {
        this.captureScreenshot();
      } else {
        console.log('📸 Capture ignorée - utilisateur non check-in');
      }
    }, this.SCREENSHOT_INTERVAL);
  }

  async captureScreenshot(): Promise<void> {
    try {
      console.log('📸 Capture d\'écran en cours...');
      
      const html2canvasModule = await import('html2canvas');
      const html2canvas = html2canvasModule.default;
      
      const canvas = await html2canvas(document.body, {
        scale: 0.5,
        logging: false,
        useCORS: true,
        backgroundColor: '#ffffff'
      });
      
      const imageData = canvas.toDataURL('image/png');
      
      this.apiService.captureAndCompare(imageData, null).subscribe({
        next: (response: any) => {
          if (response && response.success) {
            console.log(`✅ Capture sauvegardée - ${response.message}`);
            if (response.is_identical) {
              console.log(`📊 Similarité: ${response.similarity_score}% - Capture identique, ancienne supprimée`);
            }
          }
        },
        error: (err: any) => {
          console.error('❌ Erreur lors de l\'envoi de la capture:', err);
        }
      });
      
    } catch (error) {
      console.error('❌ Erreur capture écran:', error);
    }
  }

  // ========== AI SCORE METHODS ==========

  calculateAIScore(): void {
    this.isCalculatingScore = true;
    
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 7);
    
    const startDateStr = startDate.toISOString().split('T')[0];
    const endDateStr = endDate.toISOString().split('T')[0];
    
    console.log('🤖 Calcul du score IA pour la période:', startDateStr, '→', endDateStr);
    
    this.apiService.exportForAI(startDateStr, endDateStr).subscribe({
      next: (response: any) => {
        if (response && response.success) {
          console.log('📊 Données exportées avec succès');
          
          this.aiScoreService.calculateScore(response.data).subscribe({
            next: (result: any) => {
              this.aiScore = result.score;
              this.aiLevel = result.level;
              this.aiRecommendations = result.recommendations;
              this.isCalculatingScore = false;
              console.log(`🤖 Score IA: ${this.aiScore}% - ${this.aiLevel}`);
              console.log('📝 Recommandations:', this.aiRecommendations);
            },
            error: (err: any) => {
              console.error('❌ Erreur calcul IA:', err);
              this.isCalculatingScore = false;
            }
          });
        }
      },
      error: (err: any) => {
        console.error('❌ Erreur export données:', err);
        this.isCalculatingScore = false;
      }
    });
  }
}