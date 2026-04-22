import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
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

import { ManagerService, Attendance, User, AttendanceStats } from '../../../services/manager';
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
  
  // Données
  employees: User[] = [];
  selectedEmployee: User | null = null;
  attendances: Attendance[] = [];
  stats: AttendanceStats | null = null;
  
  // Filtres
  selectedMonth: string = new Date().toISOString().split('T')[0].substring(0, 7);
  selectedStatus: string = 'ALL';
  searchTerm: string = '';
  
  // UI State
  isLoading = false;
  isLoadingStats = false;
  useMockData = false; // 🔥 Désactivé - on utilise les données réelles
  displayedColumns: string[] = ['date', 'check_in', 'check_out', 'work_hours', 'statuts', 'late_minutes', 'notes'];
  
  // Statistiques pour le dashboard
  summaryStats = {
    totalEmployees: 0,
    presentToday: 0,
    absentToday: 0,
    lateToday: 0,
    avgAttendanceRate: 0
  };
  
  // Présences du jour
  todayAttendances: Attendance[] = [];
  
  private subscriptions: any[] = [];
  
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
    this.subscriptions.forEach(sub => sub?.unsubscribe());
  }
  
  /**
   * Charger la liste des employés depuis la base de données
   * Récupère uniquement les utilisateurs avec le rôle EMPLOYEE
   */
 loadEmployees(): void {
  this.isLoading = true;
  
  this.managerService.getUsers().subscribe({
    next: (response) => {
      console.log('📦 Réponse getUsers complète:', response);
      
      const users = response?.data || [];
      console.log('📋 Utilisateurs bruts:', users);
      
      // Filtrer pour n'avoir que les employés
      this.employees = users.filter((user: User) => {
        const roleName = user.role?.name?.toLowerCase();
        const roleType = user.role?.type?.toLowerCase();
        
        console.log(`🔍 Vérification user ${user.username}: role.name=${roleName}, role.type=${roleType}`);
        
        // Accepter 'employee' ou 'employe' (avec accents)
        return roleName === 'employee' || roleName === 'employe' || 
               roleType === 'employee' || roleType === 'employe';
      });
      
      this.summaryStats.totalEmployees = this.employees.length;
      this.isLoading = false;
      
      console.log(`✅ ${this.employees.length} employés chargés`);
      this.employees.forEach(emp => console.log(`   - ${emp.username} (ID: ${emp.id})`));
      
      if (this.employees.length > 0 && !this.selectedEmployee) {
        this.selectedEmployee = this.employees[0];
        this.loadAttendanceData();
      } else if (this.employees.length === 0) {
        console.warn('⚠️ Aucun employé trouvé après filtrage');
        this.snackBar.open('Aucun employé trouvé dans la base de données', 'Fermer', { duration: 3000 });
      }
      this.cdr.detectChanges();
    },
    error: (error) => {
      console.error('❌ Erreur chargement employés:', error);
      this.snackBar.open('Erreur lors du chargement des employés', 'Fermer', { duration: 3000 });
      this.isLoading = false;
      this.cdr.detectChanges();
    }
  });
}
  
  /**
   * Charger les données de présence pour un employé
   */
  loadAttendanceData(): void {
    if (!this.selectedEmployee) return;
    
    this.isLoading = true;
    
    const startDate = `${this.selectedMonth}-01`;
    const endDate = new Date(parseInt(this.selectedMonth.split('-')[0]), parseInt(this.selectedMonth.split('-')[1]), 0).toISOString().split('T')[0];
    
    this.managerService.getAttendances(this.selectedEmployee.id, startDate, endDate).subscribe({
      next: (response) => {
        this.attendances = response?.data || [];
        this.isLoading = false;
        this.loadStats();
        this.cdr.detectChanges();
        console.log(`✅ ${this.attendances.length} présences chargées pour ${this.selectedEmployee?.username}`);
      },
      error: (error) => {
        console.error('❌ Erreur chargement présences:', error);
        this.snackBar.open('Erreur lors du chargement des présences', 'Fermer', { duration: 3000 });
        this.isLoading = false;
        this.cdr.detectChanges();
      }
    });
  }
  
  /**
   * Charger les statistiques pour un employé
   */
  loadStats(): void {
    if (!this.selectedEmployee) return;
    
    this.isLoadingStats = true;
    
    this.managerService.getAttendanceStats(this.selectedEmployee.id, this.selectedMonth).subscribe({
      next: (response) => {
        this.stats = response?.data || null;
        this.isLoadingStats = false;
        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error('❌ Erreur chargement stats:', error);
        this.isLoadingStats = false;
        this.cdr.detectChanges();
      }
    });
  }
  
  /**
   * Charger le résumé des présences du jour
   */
  loadTodaySummary(): void {
  const today = new Date().toISOString().split('T')[0];
  
  // Récupérer d'abord tous les employés
  this.managerService.getUsers().subscribe({
    next: (usersResponse) => {
      const allEmployees = usersResponse?.data || [];
      const employees = allEmployees.filter((user: User) => {
        const roleName = user.role?.name?.toLowerCase();
        const roleType = user.role?.type?.toLowerCase();
        return roleName === 'employee' || roleType === 'employee';
      });
      
      this.summaryStats.totalEmployees = employees.length;
      
      // Si pas d'employés, on arrête
      if (employees.length === 0) {
        console.log('ℹ️ Aucun employé trouvé');
        this.cdr.detectChanges();
        return;
      }
      
      // Récupérer les présences du jour pour chaque employé
      // Au lieu d'un seul appel avec filtres, on fait des appels individuels
      const todayAttendances: Attendance[] = [];
      let completed = 0;
      
      employees.forEach((employee: User) => {
        this.managerService.getAttendances(employee.id).subscribe({
          next: (response) => {
            const attendances = response?.data || [];
            // Filtrer les présences du jour
            const todayAttendance = attendances.find(a => {
              const attendanceDate = new Date(a.date).toISOString().split('T')[0];
              return attendanceDate === today;
            });
            
            if (todayAttendance) {
              todayAttendances.push(todayAttendance);
            }
            
            completed++;
            
            // Quand tous les appels sont terminés
            if (completed === employees.length) {
              this.todayAttendances = todayAttendances;
              
              this.summaryStats.presentToday = this.todayAttendances.filter(a => 
                a.statuts === 'PRESENT' || a.statuts === 'LATE'
              ).length;
              this.summaryStats.absentToday = this.todayAttendances.filter(a => 
                a.statuts === 'ABSENT'
              ).length;
              this.summaryStats.lateToday = this.todayAttendances.filter(a => 
                a.statuts === 'LATE'
              ).length;
              
              if (this.summaryStats.totalEmployees > 0) {
                const attendanceRate = (this.summaryStats.presentToday / this.summaryStats.totalEmployees) * 100;
                this.summaryStats.avgAttendanceRate = Math.round(attendanceRate);
              }
              
              this.cdr.detectChanges();
              console.log(`✅ Résumé du jour chargé: ${this.todayAttendances.length} présences`);
            }
          },
          error: (error) => {
            console.error(`❌ Erreur chargement présence pour ${employee.username}:`, error);
            completed++;
            
            if (completed === employees.length) {
              this.cdr.detectChanges();
            }
          }
        });
      });
    },
    error: (error) => {
      console.error('❌ Erreur chargement employés pour summary:', error);
      this.cdr.detectChanges();
    }
  });
}
  
  /**
   * Changer d'employé
   */
  onEmployeeChange(employee: User): void {
    this.selectedEmployee = employee;
    this.loadAttendanceData();
  }
  
  /**
   * Changer de mois
   */
  onMonthChange(): void {
    this.loadAttendanceData();
  }
  
  /**
   * Exporter la fiche de présence PDF
   */
  exportToPDF(): void {
    if (!this.selectedEmployee) return;
    
    this.isLoading = true;
    
    this.managerService.exportAttendanceToPDF(this.selectedEmployee.id, this.selectedMonth).subscribe({
      next: (blob) => {
        const fileName = `fiche_presence_${this.selectedEmployee?.username}_${this.selectedMonth}.pdf`;
        saveAs(blob, fileName);
        this.snackBar.open('📄 PDF exporté avec succès', 'Fermer', { duration: 3000 });
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error('❌ Erreur export PDF:', error);
        this.snackBar.open('Erreur lors de l\'export PDF', 'Fermer', { duration: 3000 });
        this.isLoading = false;
        this.cdr.detectChanges();
      }
    });
  }
  
  /**
   * Exporter toutes les fiches du mois
   */
  exportAllToPDF(): void {
    if (this.employees.length === 0) {
      this.snackBar.open('Aucun employé à exporter', 'Fermer', { duration: 3000 });
      return;
    }
    
    this.isLoading = true;
    let completed = 0;
    let errors = 0;
    
    this.employees.forEach(employee => {
      this.managerService.exportAttendanceToPDF(employee.id, this.selectedMonth).subscribe({
        next: (blob) => {
          const fileName = `fiche_presence_${employee.username}_${this.selectedMonth}.pdf`;
          saveAs(blob, fileName);
          completed++;
          
          if (completed + errors === this.employees.length) {
            this.snackBar.open(`📄 ${completed} fiches PDF exportées${errors > 0 ? ` (${errors} erreurs)` : ''}`, 'Fermer', { duration: 3000 });
            this.isLoading = false;
            this.cdr.detectChanges();
          }
        },
        error: (error) => {
          console.error(`❌ Erreur export pour ${employee.username}:`, error);
          errors++;
          
          if (completed + errors === this.employees.length) {
            this.snackBar.open(`⚠️ ${completed} exportés, ${errors} erreurs`, 'Fermer', { duration: 3000 });
            this.isLoading = false;
            this.cdr.detectChanges();
          }
        }
      });
    });
  }
  
  /**
   * Filtrer les présences affichées
   */
  getFilteredAttendances(): Attendance[] {
    let filtered = [...this.attendances];
    
    if (this.selectedStatus !== 'ALL') {
      filtered = filtered.filter(a => a.statuts === this.selectedStatus);
    }
    
    if (this.searchTerm) {
      const term = this.searchTerm.toLowerCase();
      filtered = filtered.filter(a => 
        a.notes?.toLowerCase().includes(term) ||
        new Date(a.date).toLocaleDateString().includes(term)
      );
    }
    
    return filtered;
  }
  
  /**
   * Obtenir la couleur du statut
   */
  getStatusColor(status: string): string {
    const colors: Record<string, string> = {
      'PRESENT': '#10b981',
      'ABSENT': '#ef4444',
      'LATE': '#f59e0b',
      'HALF_DAY': '#8b5cf6',
      'HOLIDAY': '#3b82f6'
    };
    return colors[status] || '#6b7280';
  }
  
  /**
   * Obtenir le libellé du statut
   */
  getStatusLabel(status: string): string {
    const labels: Record<string, string> = {
      'PRESENT': 'Présent',
      'ABSENT': 'Absent',
      'LATE': 'En retard',
      'HALF_DAY': 'Demi-journée',
      'HOLIDAY': 'Congé'
    };
    return labels[status] || status;
  }
  
  /**
   * Formater l'heure
   */
  formatTime(dateTime: string | null): string {
    if (!dateTime) return '—';
    const date = new Date(dateTime);
    return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  }
  
  /**
   * Formater la date
   */
  formatDate(date: string): string {
    return new Date(date).toLocaleDateString('fr-FR', {
      weekday: 'short',
      day: '2-digit',
      month: '2-digit'
    });
  }
  
  /**
   * Calculer le taux de présence
   */
  getAttendanceRate(): number {
    if (!this.stats || this.stats.totalDays === 0) return 0;
    return Math.round((this.stats.presentDays / this.stats.totalDays) * 100);
  }
}