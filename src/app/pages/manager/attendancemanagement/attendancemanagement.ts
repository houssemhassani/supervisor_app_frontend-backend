import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, forkJoin } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

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
  AttendanceStats
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
  attendanceRate: number = 0;
  employees: User[] = [];
  selectedEmployee: User | null = null;

  attendances: Attendance[] = [];
  stats: AttendanceStats | null = null;

  selectedMonth: string =
    new Date().toISOString().substring(0, 7);

  selectedStatus: string = 'ALL';
  searchTerm: string = '';

  isLoading = false;
  isLoadingStats = false;

  displayedColumns: string[] = [
    'date',
    'check_in',
    'check_out',
    'work_hours',
    'statuts',
    'late_minutes',
    'notes'
  ];

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
    this.loadEmployees();
    this.loadTodaySummary();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // =========================
  // EMPLOYEES
  // =========================

  loadEmployees(): void {
    this.isLoading = true;

    this.managerService.getUsers()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          const users: User[] = res?.data ?? [];

          this.employees = users.filter((u: User) => {
            const role = u.role?.type?.toLowerCase();
            return role === 'employee';
          });

          this.summaryStats.totalEmployees = this.employees.length;

          if (!this.selectedEmployee && this.employees.length > 0) {
            this.selectedEmployee = this.employees[0];
            this.loadAttendanceData();
          }

          this.isLoading = false;
        },
        error: () => {
          this.snackBar.open('Erreur chargement employés', 'Fermer', { duration: 3000 });
          this.isLoading = false;
        }
      });
  }

  // =========================
  // ATTENDANCES
  // =========================

 loadAttendanceData(): void {
  if (!this.selectedEmployee) return;

  this.isLoading = true;

  const [year, month] = this.selectedMonth.split('-');

  const startDate = new Date(+year, +month - 1, 1).toISOString();
  const endDate = new Date(+year, +month, 0).toISOString();

  this.managerService
    .getAttendances(this.selectedEmployee.id, startDate, endDate)
    .pipe(takeUntil(this.destroy$))
    .subscribe({
      next: (res) => {
        this.attendances = res?.data ?? [];
        this.loadStats();
        this.isLoading = false;
      },
      error: () => {
        this.snackBar.open('Erreur chargement présences', 'Fermer', { duration: 3000 });
        this.isLoading = false;
      }
    });
}

  // =========================
  // STATS
  // =========================

  loadStats(): void {
    if (!this.selectedEmployee) return;

    this.isLoadingStats = true;

    this.managerService.getAttendanceStats(
      this.selectedEmployee.id,
      this.selectedMonth
    )
    .pipe(takeUntil(this.destroy$))
    .subscribe({
      next: (res) => {
  this.stats = res?.data ?? null;

  this.attendanceRate =
    this.stats?.totalDays
      ? Math.round((this.stats.presentDays / this.stats.totalDays) * 100)
      : 0;

  this.isLoadingStats = false;
},
      error: () => {
        this.isLoadingStats = false;
      }
    });
  }
 exportAllToPDF(): void {
  if (this.employees.length === 0) return;

  this.isLoading = true;

  const requests = this.employees.map(emp =>
    this.managerService.exportAttendanceToPDF(emp.id, this.selectedMonth)
  );

  forkJoin(requests)
    .pipe(takeUntil(this.destroy$))
    .subscribe({
      next: (blobs: any[]) => {
        blobs.forEach((blob, index) => {
          const emp = this.employees[index];
          saveAs(blob, `attendance_${emp.username}.pdf`);
        });

        this.isLoading = false;
      },
      error: () => {
        this.snackBar.open('Erreur export global PDF', 'Fermer', { duration: 3000 });
        this.isLoading = false;
      }
    });
}

  // =========================
  // TODAY SUMMARY (OPTIMISÉ)
  // =========================
loadTodaySummary(): void {
  const today: string = new Date().toISOString().split('T')[0];

  this.managerService.getUsers()
    .pipe(takeUntil(this.destroy$))
    .subscribe({
      next: (res) => {

        const users: User[] = res?.data ?? [];

        const employees: User[] = users.filter((u: User) =>
          u.role?.type?.toLowerCase() === 'employee'
        );

        this.summaryStats.totalEmployees = employees.length;

        const requests = employees.map((emp: User) =>
          this.managerService.getAttendances(emp.id)
        );

        forkJoin(requests)
          .pipe(takeUntil(this.destroy$))
          .subscribe({
            next: (responses) => {

              const allAttendances: Attendance[] = [];

              responses.forEach((r: any) => {

                const data: Attendance[] = r?.data ?? [];

                const todayAtt: Attendance | undefined = data.find(
                  (a: Attendance) => a.date?.split('T')[0] === today
                );

                if (todayAtt) {
                  allAttendances.push(todayAtt);
                }
              });

              this.todayAttendances = allAttendances;

              this.summaryStats.presentToday =
                allAttendances.filter(
                  (a: Attendance) =>
                    a.statuts === 'PRESENT' || a.statuts === 'LATE'
                ).length;

              this.summaryStats.absentToday =
                allAttendances.filter(
                  (a: Attendance) => a.statuts === 'ABSENT'
                ).length;

              this.summaryStats.lateToday =
                allAttendances.filter(
                  (a: Attendance) => a.statuts === 'LATE'
                ).length;

              this.summaryStats.avgAttendanceRate =
                this.summaryStats.totalEmployees
                  ? Math.round(
                      (this.summaryStats.presentToday /
                        this.summaryStats.totalEmployees) * 100
                    )
                  : 0;
            },

            error: () => {
              console.log('Erreur summary');
            }
          });
      }
    });
}

  // =========================
  // CHANGE EMPLOYEE
  // =========================

  onEmployeeChange(emp: User): void {
    this.selectedEmployee = emp;
    this.loadAttendanceData();
  }

  onMonthChange(): void {
    this.loadAttendanceData();
  }

  // =========================
  // PDF EXPORT
  // =========================

  exportToPDF(): void {
    if (!this.selectedEmployee) return;

    this.isLoading = true;

    this.managerService.exportAttendanceToPDF(
      this.selectedEmployee.id,
      this.selectedMonth
    )
    .pipe(takeUntil(this.destroy$))
    .subscribe({
      next: (blob) => {
        saveAs(blob, `attendance_${this.selectedEmployee?.username}.pdf`);
        this.isLoading = false;
      },
      error: () => {
        this.isLoading = false;
      }
    });
  }

  // =========================
  // FILTER
  // =========================

  getFilteredAttendances(): Attendance[] {
    return this.attendances.filter(a => {
      const statusOk =
        this.selectedStatus === 'ALL' ||
        a.statuts === this.selectedStatus;

      const searchOk =
        !this.searchTerm ||
        a.notes?.toLowerCase().includes(this.searchTerm.toLowerCase());

      return statusOk && searchOk;
    });
  }

  // =========================
  // UI HELPERS
  // =========================

  getStatusColor(status: string): string {
    const map: Record<string, string> = {
      PRESENT: '#10b981',
      ABSENT: '#ef4444',
      LATE: '#f59e0b',
      HALF_DAY: '#8b5cf6',
      HOLIDAY: '#3b82f6'
    };
    return map[status] || '#999';
  }

  getStatusLabel(status: string): string {
    const map: Record<string, string> = {
      PRESENT: 'Présent',
      ABSENT: 'Absent',
      LATE: 'Retard',
      HALF_DAY: 'Demi',
      HOLIDAY: 'Congé'
    };
    return map[status] || status;
  }

  formatTime(date?: string | null): string {
    if (!date) return '—';
    return new Date(date).toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  formatDate(date: string): string {
    return new Date(date).toLocaleDateString('fr-FR');
  }
}