import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, forkJoin, of } from 'rxjs';
import { takeUntil, catchError, finalize } from 'rxjs/operators';

import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatCardModule } from '@angular/material/card';
import { MatTableModule } from '@angular/material/table';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatInputModule } from '@angular/material/input';

import {
  ManagerService,
  Attendance,
  User,
  AttendanceStats,
  EmployeeWithAttendances,
  GlobalSummary
} from '../../../services/manager';

import { saveAs } from 'file-saver';

@Component({
  selector: 'app-attendance-management',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatIconModule,
    MatButtonModule,
    MatFormFieldModule,
    MatSelectModule,
    MatInputModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatProgressSpinnerModule,
    MatCardModule,
    MatTableModule,
    MatChipsModule,
    MatTooltipModule
  ],
  templateUrl: './attendancemanagement.html',
  styleUrls: ['./attendancemanagement.scss']
})
export class AttendanceManagementComponent implements OnInit, OnDestroy {
  // Données principales
  employees: User[] = [];
  employeesWithAttendances: EmployeeWithAttendances[] = [];
  selectedEmployee: User | null = null;
  expandedEmployeeId: number | null = null;
  
  // Présences et stats
  attendances: Attendance[] = [];
  stats: AttendanceStats | null = null;
  attendanceRate: number = 0;
  
  // Filtres
  selectedMonth: string = new Date().toISOString().substring(0, 7);
  selectedStatus: string = 'ALL';
  searchTerm: string = '';
  
  // Filtres par employé (pour la vue étendue)
  employeeFilters: Map<number, { month: string; status: string; search: string }> = new Map();
  employeeStats: Map<number, AttendanceStats> = new Map();
  employeeAttendances: Map<number, Attendance[]> = new Map();
  isLoadingAttendances: Map<number, boolean> = new Map();
  
  // États de chargement
  isLoading = false;
  isLoadingStats = false;
  isLoadingSummary = false;
  
  // Statistiques globales
  summaryStats = {
    totalEmployees: 0,
    presentToday: 0,
    absentToday: 0,
    lateToday: 0,
    avgAttendanceRate: 0
  };
  
  todayAttendances: Attendance[] = [];
  
  private destroy$ = new Subject<void>();

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
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ============================================
  // CHARGEMENT PRINCIPAL
  // ============================================

  /**
   * Charge toutes les données nécessaires en une seule requête optimisée
   */
  loadAllData(): void {
    this.isLoading = true;
    
    this.managerService.getAllEmployeesWithAttendances(this.selectedMonth, this.selectedStatus)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => {
          this.isLoading = false;
          this.cdr.detectChanges();
        })
      )
      .subscribe({
        next: (response) => {
          const data = response.data;
          
          // Récupérer les employés avec leurs présences
          this.employeesWithAttendances = data?.employees || [];
          
          // Construire la liste simple des employés
          this.employees = this.employeesWithAttendances.map(emp => ({
            id: emp.id,
            username: emp.username,
            email: emp.email,
            firstname: emp.firstname,
            lastname: emp.lastname,
            position: emp.position
          }));
          
          // Mettre à jour les statistiques globales
          if (data?.summary) {
            this.summaryStats = data.summary;
          }
          
          // Initialiser les maps pour chaque employé
          this.employeesWithAttendances.forEach(emp => {
            // Stocker les présences
            this.employeeAttendances.set(emp.id, emp.attendances);
            
            // Stocker les stats
            this.employeeStats.set(emp.id, emp.stats);
            
            // Initialiser les filtres
            this.employeeFilters.set(emp.id, {
              month: this.selectedMonth,
              status: 'ALL',
              search: ''
            });
            
            this.isLoadingAttendances.set(emp.id, false);
          });
          
          // Sélectionner le premier employé par défaut
          if (this.employees.length > 0 && !this.selectedEmployee) {
            this.selectedEmployee = this.employees[0];
            this.loadAttendanceData();
          }
          
          this.snackBar.open('Données chargées avec succès', 'Fermer', { duration: 3000 });
        },
        error: (error) => {
          console.error('Erreur chargement:', error);
          this.snackBar.open('Erreur lors du chargement des données', 'Fermer', { duration: 3000 });
          
          // Fallback: charger séparément
          this.loadEmployeesFallback();
          this.loadTodaySummary();
        }
      });
  }

  /**
   * Méthode de fallback si l'API groupée n'est pas disponible
   */
  private loadEmployeesFallback(): void {
    this.managerService.getAllEmployees()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.employees = response.data || [];
          this.summaryStats.totalEmployees = this.employees.length;
          
          if (this.employees.length > 0 && !this.selectedEmployee) {
            this.selectedEmployee = this.employees[0];
            this.loadAttendanceData();
          }
        },
        error: (error) => {
          console.error('Erreur fallback:', error);
        }
      });
  }

  /**
   * Charge les présences pour l'employé sélectionné
   */
  loadAttendanceData(): void {
    if (!this.selectedEmployee) return;
    
    this.isLoading = true;
    this.isLoadingStats = true;
    
    const employeeId = this.selectedEmployee.id;
    
    // Utiliser les données déjà chargées si disponibles
    const existingAttendances = this.employeeAttendances.get(employeeId);
    const existingStats = this.employeeStats.get(employeeId);
    
    if (existingAttendances && existingStats) {
      this.attendances = existingAttendances;
      this.stats = existingStats;
      this.attendanceRate = existingStats.attendanceRate;
      this.isLoading = false;
      this.isLoadingStats = false;
      this.cdr.detectChanges();
      return;
    }
    
    // Sinon, charger depuis l'API
    this.managerService.getEmployeeAttendancesByMonth(employeeId, this.selectedMonth, this.selectedStatus)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => {
          this.isLoading = false;
          this.isLoadingStats = false;
          this.cdr.detectChanges();
        })
      )
      .subscribe({
        next: (response) => {
          this.attendances = response.data?.attendances || [];
          this.stats = response.data?.stats || null;
          this.attendanceRate = this.stats?.attendanceRate || 0;
          
          // Mettre en cache
          this.employeeAttendances.set(employeeId, this.attendances);
          this.employeeStats.set(employeeId, this.stats!);
        },
        error: (error) => {
          console.error('Erreur chargement présences:', error);
          this.snackBar.open('Erreur lors du chargement des présences', 'Fermer', { duration: 3000 });
          this.attendances = [];
          this.stats = null;
          this.attendanceRate = 0;
        }
      });
  }

  /**
   * Charge les présences pour un employé spécifique dans la vue étendue
   */
  loadEmployeeAttendance(employeeId: number): void {
    const filter = this.employeeFilters.get(employeeId);
    if (!filter) return;
    
    this.isLoadingAttendances.set(employeeId, true);
    this.cdr.detectChanges();
    
    this.managerService.getEmployeeAttendancesByMonth(employeeId, filter.month, filter.status)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => {
          this.isLoadingAttendances.set(employeeId, false);
          this.cdr.detectChanges();
        })
      )
      .subscribe({
        next: (response) => {
          const attendances = response.data?.attendances || [];
          const stats = response.data?.stats;
          
          this.employeeAttendances.set(employeeId, attendances);
          if (stats) {
            this.employeeStats.set(employeeId, stats);
          }
        },
        error: (error) => {
          console.error(`Erreur chargement présences employé ${employeeId}:`, error);
          this.snackBar.open('Erreur lors du chargement des présences', 'Fermer', { duration: 3000 });
        }
      });
  }

  /**
   * Filtre les présences d'un employé dans la vue étendue
   */
  filterEmployeeAttendance(employeeId: number): void {
    const filter = this.employeeFilters.get(employeeId);
    if (!filter) return;
    
    // Recharger avec le nouveau filtre
    this.loadEmployeeAttendance(employeeId);
  }

  /**
   * Charge le résumé du jour
   */
  loadTodaySummary(): void {
    this.isLoadingSummary = true;
    
    this.managerService.getTodayAttendances()
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => {
          this.isLoadingSummary = false;
          this.cdr.detectChanges();
        })
      )
      .subscribe({
        next: (response) => {
          this.todayAttendances = response.data || [];
          
          this.summaryStats.presentToday = this.todayAttendances.filter(
            a => a.statuts === 'PRESENT' || a.statuts === 'LATE'
          ).length;
          
          this.summaryStats.absentToday = this.todayAttendances.filter(
            a => a.statuts === 'ABSENT'
          ).length;
          
          this.summaryStats.lateToday = this.todayAttendances.filter(
            a => a.statuts === 'LATE'
          ).length;
          
          this.summaryStats.avgAttendanceRate = this.summaryStats.totalEmployees
            ? Math.round((this.summaryStats.presentToday / this.summaryStats.totalEmployees) * 100)
            : 0;
        },
        error: (error) => {
          console.error('Erreur chargement résumé:', error);
        }
      });
  }

  // ============================================
  // GESTION DES EMPLOYÉS (VUE ÉTENDUE)
  // ============================================

  /**
   * Affiche/masque les détails d'un employé
   */
  toggleEmployee(employeeId: number): void {
    if (this.expandedEmployeeId === employeeId) {
      this.expandedEmployeeId = null;
    } else {
      this.expandedEmployeeId = employeeId;
      // Charger les données si nécessaire
      const hasData = this.employeeAttendances.has(employeeId);
      if (!hasData) {
        this.loadEmployeeAttendance(employeeId);
      }
    }
    this.cdr.detectChanges();
  }

  /**
   * Récupère les présences filtrées d'un employé (vue étendue)
   */
  getFilteredEmployeeAttendances(employeeId: number): Attendance[] {
    const attendances = this.employeeAttendances.get(employeeId) || [];
    const filter = this.employeeFilters.get(employeeId);
    
    if (!filter) return attendances;
    
    return attendances.filter(attendance => {
      // Filtre par statut
      if (filter.status !== 'ALL' && attendance.statuts !== filter.status) {
        return false;
      }
      
      // Filtre par recherche
      if (filter.search && filter.search.trim() !== '') {
        const searchLower = filter.search.toLowerCase();
        const notesMatch = attendance.notes?.toLowerCase().includes(searchLower) || false;
        const dateMatch = new Date(attendance.date).toLocaleDateString('fr-FR').includes(searchLower);
        return notesMatch || dateMatch;
      }
      
      return true;
    });
  }

  // ============================================
  // ACTIONS
  // ============================================

  /**
   * Change l'employé sélectionné
   */
  onEmployeeChange(employee: User): void {
    this.selectedEmployee = employee;
    this.loadAttendanceData();
  }

  /**
   * Change le mois sélectionné
   */
  onMonthChange(): void {
    this.loadAllData(); // Recharger toutes les données avec le nouveau mois
    if (this.selectedEmployee) {
      this.loadAttendanceData();
    }
  }

  /**
   * Exporte le PDF pour l'employé sélectionné
   */
exportToPDF(): void {
  if (!this.selectedEmployee) {
    this.snackBar.open('Veuillez sélectionner un employé', 'Fermer', { duration: 3000 });
    return;
  }

  this.isLoading = true;

  const { id, username } = this.selectedEmployee;

  this.managerService.exportEmployeePDF(id, this.selectedMonth)
    .pipe(
      takeUntil(this.destroy$),
      finalize(() => {
        this.isLoading = false;
        this.cdr.detectChanges();
      })
    )
    .subscribe({
      next: (blob: Blob) => {
        saveAs(blob, `attendance_${username}_${this.selectedMonth}.pdf`);

        this.snackBar.open('PDF exporté avec succès', 'Fermer', { duration: 3000 });
      },
      error: (error) => {
        console.error('Erreur export PDF:', error);
        this.snackBar.open('Erreur lors de l\'export PDF', 'Fermer', { duration: 3000 });
      }
    });
}
exportEmployeePDF(employee: User, event: Event): void {
  event.stopPropagation();

  const filter = this.employeeFilters.get(employee.id);
  const month = filter?.month || this.selectedMonth;

  this.managerService.exportEmployeePDF(employee.id, month)
    .pipe(takeUntil(this.destroy$))
    .subscribe({
      next: (blob: Blob) => {
        saveAs(blob, `attendance_${employee.username}_${month}.pdf`);
        this.snackBar.open(`PDF exporté pour ${employee.username}`, 'Fermer', { duration: 3000 });
      },
      error: (error: any) => {
        console.error(error);
        this.snackBar.open('Erreur lors de l\'export PDF', 'Fermer', { duration: 3000 });
      }
    });
}
exportAllToPDF(): void {
  if (!this.employees?.length) {
    this.snackBar.open('Aucun employé trouvé', 'Fermer', { duration: 3000 });
    return;
  }

  this.isLoading = true;

  const requests = this.employees.map(emp =>
    this.managerService.exportEmployeePDF(emp.id, this.selectedMonth)
  );

  forkJoin(requests)
    .pipe(
      takeUntil(this.destroy$),
      finalize(() => {
        this.isLoading = false;
        this.cdr.detectChanges();
      })
    )
    .subscribe({
      next: (blobs: Blob[]) => {
        blobs.forEach((blob, index) => {
          const emp = this.employees[index];
          saveAs(blob, `attendance_${emp.username}_${this.selectedMonth}.pdf`);
        });

        this.snackBar.open(
          `${this.employees.length} PDF exportés avec succès`,
          'Fermer',
          { duration: 3000 }
        );
      },
      error: (error: any) => {
        console.error(error);
        this.snackBar.open('Erreur lors de l\'export global', 'Fermer', { duration: 3000 });
      }
    });
}

  // ============================================
  // FILTRES
  // ============================================

  /**
   * Applique les filtres sur les présences affichées
   */
  getFilteredAttendances(): Attendance[] {
    let filtered = this.attendances;
    
    // Filtre par statut
    if (this.selectedStatus !== 'ALL') {
      filtered = filtered.filter(a => a.statuts === this.selectedStatus);
    }
    
    // Filtre par recherche
    if (this.searchTerm && this.searchTerm.trim() !== '') {
      const searchLower = this.searchTerm.toLowerCase();
      filtered = filtered.filter(a => {
        const notesMatch = a.notes?.toLowerCase().includes(searchLower) || false;
        const dateMatch = new Date(a.date).toLocaleDateString('fr-FR').includes(searchLower);
        return notesMatch || dateMatch;
      });
    }
    
    return filtered;
  }

  // ============================================
  // UTILITAIRES
  // ============================================

  /**
   * Obtient la couleur associée à un statut
   */
  getStatusColor(status: string): string {
    const map: Record<string, string> = {
      PRESENT: '#10b981',
      ABSENT: '#ef4444',
      LATE: '#f59e0b',
      HALF_DAY: '#8b5cf6',
      HOLIDAY: '#3b82f6'
    };
    return map[status] || '#6b7280';
  }

  /**
   * Obtient le libellé d'un statut
   */
  getStatusLabel(status: string): string {
    const map: Record<string, string> = {
      PRESENT: 'Présent',
      ABSENT: 'Absent',
      LATE: 'Retard',
      HALF_DAY: 'Demi-journée',
      HOLIDAY: 'Congé'
    };
    return map[status] || status;
  }

  /**
   * Formate l'heure
   */
  formatTime(date?: string | null): string {
    if (!date) return '—';
    try {
      return new Date(date).toLocaleTimeString('fr-FR', {
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return '—';
    }
  }

  /**
   * Formate la date
   */
  formatDate(date: string): string {
    if (!date) return '—';
    try {
      return new Date(date).toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });
    } catch {
      return '—';
    }
  }

  /**
   * Rafraîchit les données
   */
  refreshData(): void {
    this.loadAllData();
    if (this.selectedEmployee) {
      this.loadAttendanceData();
    }
    this.snackBar.open('Données rafraîchies', 'Fermer', { duration: 2000 });
  }
  onEmployeeMonthChange(employeeId: number, event: Event): void {
  const value = (event.target as HTMLInputElement).value;

  const filter = this.employeeFilters.get(employeeId);
  if (filter) {
    this.employeeFilters.set(employeeId, {
      ...filter,
      month: value
    });
  }

  this.loadEmployeeAttendance(employeeId);
}
onEmployeeStatusChange(employeeId: number, status: string): void {
  const filter = this.employeeFilters.get(employeeId);
  if (filter) {
    this.employeeFilters.set(employeeId, {
      ...filter,
      status
    });
  }

  this.loadEmployeeAttendance(employeeId);
}
onEmployeeSearch(employeeId: number, event: Event): void {
  const value = (event.target as HTMLInputElement).value;

  const filter = this.employeeFilters.get(employeeId);
  if (filter) {
    this.employeeFilters.set(employeeId, {
      ...filter,
      search: value
    });
  }

  // option 1: filtrage local (plus rapide)
  // rien à appeler ici

  // option 2: reload backend (si tu veux filtrer serveur)
  this.loadEmployeeAttendance(employeeId);
}
}