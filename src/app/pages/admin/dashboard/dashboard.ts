// dashboard.component.ts (complété)
import { Component, OnInit, AfterViewInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Chart, ChartConfiguration, registerables } from 'chart.js';
import { BaseChartDirective } from 'ng2-charts';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

Chart.register(...registerables);

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, BaseChartDirective],
  templateUrl: './dashboard.html',
  styleUrls: ['./dashboard.scss']
})
export class AdminDashboard implements OnInit, AfterViewInit {
  
  @ViewChild(BaseChartDirective) chart?: BaseChartDirective;

  currentDate = new Date();
  selectedPeriod = 'month';
  searchTerm = '';
  chartType: 'bar' | 'line' = 'bar';
  isLoading = false;
  showNotification = false;
  notificationMessage = '';
  notificationType = 'success';
  notificationIcon = '✅';

  // KPI Data
  kpis = [
    { label: 'Productivité moyenne', value: '74%', icon: '📈', trend: '+12%', trendClass: 'positive', trendIcon: '↑', color: 'blue' },
    { label: 'Employés actifs', value: '24', icon: '👥', trend: '+3', trendClass: 'positive', trendIcon: '↑', color: 'green' },
    { label: 'Tâches complétées', value: '156', icon: '✅', trend: '+28', trendClass: 'positive', trendIcon: '↑', color: 'purple' },
    { label: 'Heures travaillées', value: '1,284', icon: '⏱️', trend: '+5.2%', trendClass: 'positive', trendIcon: '↑', color: 'orange' }
  ];

  // Chart Configuration
  productivityData: ChartConfiguration<'bar' | 'line'>['data'] = {
    labels: ['Alice Martin', 'Bob Robert', 'Charlie Dubois', 'David Leroy', 'Eve Bernard', 'Frank Moreau', 'Grace Petit'],
    datasets: [
      { 
        data: [75, 88, 62, 90, 55, 82, 78], 
        label: 'Score de productivité', 
        backgroundColor: 'rgba(99, 102, 241, 0.8)',
        borderColor: '#6366f1',
        borderWidth: 2,
        borderRadius: 8,
        tension: 0.4
      }
    ]
  };

  productivityOptions: ChartConfiguration<'bar' | 'line'>['options'] = {
    responsive: true,
    maintainAspectRatio: true,
    plugins: {
      legend: { 
        display: true,
        position: 'top',
        labels: {
          color: 'white',
          font: { size: 12, weight: 'bold' }
        }
      },
      tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        titleColor: 'white',
        bodyColor: 'rgba(255, 255, 255, 0.8)',
        borderColor: '#6366f1',
        borderWidth: 1,
        callbacks: {
          label: (context) => `Productivité: ${context.raw}%`
        }
      }
    },
    scales: {
      y: { 
        beginAtZero: true, 
        max: 100,
        grid: {
          color: 'rgba(255, 255, 255, 0.1)',
          drawOnChartArea: true,
          drawTicks: true
        },
        title: {
          display: true,
          text: 'Productivité (%)',
          color: 'rgba(255, 255, 255, 0.7)'
        },
        ticks: {
          color: 'rgba(255, 255, 255, 0.7)'
        }
      },
      x: { 
        grid: {
          color: 'rgba(255, 255, 255, 0.1)',
          display: false
        },
        ticks: { 
          color: 'rgba(255, 255, 255, 0.7)', 
          font: { size: 11, weight: 'bold' } 
        },
        title: {
          display: true,
          text: 'Employés',
          color: 'rgba(255, 255, 255, 0.7)'
        }
      }
    },
    elements: {
      point: {
        radius: 4,
        hoverRadius: 6,
        backgroundColor: '#6366f1',
        borderColor: 'white',
        borderWidth: 2
      }
    }
  };

  filteredReports = [
    { 
      user: 'Alice Martin', 
      role: 'Développeur Senior',
      workTime: 420, 
      keyboardClicks: 3200, 
      mouseClicks: 1800, 
      screenshots: 10, 
      productivityScore: 75,
      tasksCompleted: 12,
      tasksTotal: 16,
      avatarGradient: 'linear-gradient(135deg, #3b82f6, #2563eb)'
    },
    { 
      user: 'Bob Robert', 
      role: 'Chef de Projet',
      workTime: 480, 
      keyboardClicks: 3500, 
      mouseClicks: 2100, 
      screenshots: 12, 
      productivityScore: 88,
      tasksCompleted: 14,
      tasksTotal: 16,
      avatarGradient: 'linear-gradient(135deg, #10b981, #059669)'
    },
    { 
      user: 'Charlie Dubois', 
      role: 'UI/UX Designer',
      workTime: 360, 
      keyboardClicks: 2800, 
      mouseClicks: 2200, 
      screenshots: 8, 
      productivityScore: 62,
      tasksCompleted: 10,
      tasksTotal: 16,
      avatarGradient: 'linear-gradient(135deg, #f59e0b, #d97706)'
    },
    { 
      user: 'David Leroy', 
      role: 'DevOps Engineer',
      workTime: 500, 
      keyboardClicks: 3800, 
      mouseClicks: 1900, 
      screenshots: 15, 
      productivityScore: 90,
      tasksCompleted: 15,
      tasksTotal: 16,
      avatarGradient: 'linear-gradient(135deg, #8b5cf6, #7c3aed)'
    },
    { 
      user: 'Eve Bernard', 
      role: 'Développeur Junior',
      workTime: 300, 
      keyboardClicks: 2400, 
      mouseClicks: 1600, 
      screenshots: 6, 
      productivityScore: 55,
      tasksCompleted: 8,
      tasksTotal: 16,
      avatarGradient: 'linear-gradient(135deg, #ef4444, #dc2626)'
    },
    { 
      user: 'Frank Moreau', 
      role: 'Data Scientist',
      workTime: 450, 
      keyboardClicks: 3400, 
      mouseClicks: 1700, 
      screenshots: 11, 
      productivityScore: 82,
      tasksCompleted: 13,
      tasksTotal: 16,
      avatarGradient: 'linear-gradient(135deg, #14b8a6, #0d9488)'
    },
    { 
      user: 'Grace Petit', 
      role: 'QA Engineer',
      workTime: 400, 
      keyboardClicks: 2900, 
      mouseClicks: 2000, 
      screenshots: 9, 
      productivityScore: 78,
      tasksCompleted: 12,
      tasksTotal: 16,
      avatarGradient: 'linear-gradient(135deg, #ec489a, #db2777)'
    }
  ];

  allReports = [...this.filteredReports];

  constructor() {}

  ngOnInit(): void {
    this.updateKPIs();
  }

  ngAfterViewInit(): void {
    if (this.chart) {
      this.chart.update();
    }
  }

  setPeriod(period: string): void {
    this.selectedPeriod = period;
    this.showNotificationMessage('Période modifiée', 'success');
    this.updateKPIs();
  }

  toggleChartType(): void {
    this.chartType = this.chartType === 'bar' ? 'line' : 'bar';
    setTimeout(() => {
      if (this.chart) {
        this.chart.update();
      }
    }, 0);
  }

  refreshChart(): void {
    // Simuler un rafraîchissement des données du graphique
    this.showNotificationMessage('Graphique rafraîchi', 'success');
  }

  filterEmployees(): void {
    if (!this.searchTerm) {
      this.filteredReports = [...this.allReports];
      return;
    }
    
    this.filteredReports = this.allReports.filter(emp => 
      emp.user.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
      emp.role.toLowerCase().includes(this.searchTerm.toLowerCase())
    );
  }

  updateKPIs(): void {
    const avgProductivity = this.getAverageProductivity();
    this.kpis[0].value = `${avgProductivity}%`;
    
    // Simulation de mise à jour des KPIs en fonction de la période
    if (this.selectedPeriod === 'week') {
      this.kpis[1].value = '18';
      this.kpis[2].value = '42';
      this.kpis[3].value = '312';
    } else if (this.selectedPeriod === 'month') {
      this.kpis[1].value = '24';
      this.kpis[2].value = '156';
      this.kpis[3].value = '1,284';
    } else if (this.selectedPeriod === 'year') {
      this.kpis[1].value = '28';
      this.kpis[2].value = '1,872';
      this.kpis[3].value = '15,408';
    }
  }

  formatWorkTime(minutes: number): string {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours === 0) return `${mins}min`;
    if (mins === 0) return `${hours}h`;
    return `${hours}h ${mins}min`;
  }

  getAverageProductivity(): number {
    if (this.filteredReports.length === 0) return 0;
    const sum = this.filteredReports.reduce((acc, curr) => acc + curr.productivityScore, 0);
    return Math.round(sum / this.filteredReports.length);
  }

  getBestEmployee(): string {
    if (this.filteredReports.length === 0) return 'Aucun';
    const best = this.filteredReports.reduce((prev, current) => 
      (prev.productivityScore > current.productivityScore) ? prev : current
    );
    return best.user;
  }

  getTotalWorkTime(): number {
    return this.filteredReports.reduce((acc, curr) => acc + curr.workTime, 0);
  }

  getTotalClicks(): number {
    return this.filteredReports.reduce((acc, curr) => acc + curr.keyboardClicks + curr.mouseClicks, 0);
  }

  getStatusClass(score: number): string {
    if (score >= 80) return 'excellent';
    if (score >= 70) return 'good';
    if (score >= 60) return 'average';
    return 'poor';
  }

  getStatusText(score: number): string {
    if (score >= 80) return 'Excellent';
    if (score >= 70) return 'Bon';
    if (score >= 60) return 'Moyen';
    return 'À améliorer';
  }

  getTrendClass(score: number): string {
    if (score >= 80) return 'up';
    if (score >= 60) return 'stable';
    return 'down';
  }

  getTrendText(score: number): string {
    if (score >= 80) return '+12% vs mois dernier';
    if (score >= 60) return 'Stable';
    return '-8% vs mois dernier';
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

  async refreshData(): Promise<void> {
    this.isLoading = true;
    this.showNotificationMessage('Rafraîchissement des données...', 'success');
    
    try {
      // Simulation d'appel API
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Mise à jour simulée des données
      this.updateKPIs();
      this.showNotificationMessage('Données rafraîchies avec succès!', 'success');
    } catch (error) {
      this.showNotificationMessage('Erreur lors du rafraîchissement', 'error');
    } finally {
      this.isLoading = false;
    }
  }

  async exportPDF(): Promise<void> {
    try {
      const element = document.querySelector('.reports-card') as HTMLElement;
      
      if (!element) {
        this.showNotificationMessage('Erreur: Élément non trouvé', 'error');
        return;
      }

      this.showNotificationMessage('Génération du PDF...', 'success');

      const canvas = await html2canvas(element, {
        scale: 2,
        backgroundColor: '#0f172a',
        logging: false,
        useCORS: true
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4'
      });

      const imgWidth = pdf.internal.pageSize.getWidth();
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      
      pdf.setFontSize(18);
      pdf.setTextColor(99, 102, 241);
      pdf.text("Rapport de Productivité", imgWidth / 2, 15, { align: 'center' });
      
      pdf.setFontSize(10);
      pdf.setTextColor(100, 100, 100);
      const dateStr = `Généré le ${this.currentDate.toLocaleDateString('fr-FR')}`;
      pdf.text(dateStr, imgWidth / 2, 22, { align: 'center' });
      
      pdf.addImage(imgData, 'PNG', 0, 30, imgWidth, imgHeight);
      
      const fileName = `rapport_productivite_${this.currentDate.getTime()}.pdf`;
      pdf.save(fileName);
      
      this.showNotificationMessage('PDF exporté avec succès!', 'success');
      
    } catch (error) {
      console.error('Erreur PDF:', error);
      this.showNotificationMessage('Erreur lors de l\'export PDF', 'error');
    }
  }

  exportToCSV(): void {
    try {
      const headers = ['Employé', 'Rôle', 'Temps travaillé (min)', 'Clicks clavier', 'Clicks souris', 'Tâches complétées', 'Score productivité'];
      const rows = this.filteredReports.map(emp => [
        emp.user,
        emp.role,
        emp.workTime,
        emp.keyboardClicks,
        emp.mouseClicks,
        `${emp.tasksCompleted}/${emp.tasksTotal}`,
        emp.productivityScore
      ]);
      
      const csvContent = [
        headers.join(','),
        ...rows.map(row => row.join(','))
      ].join('\n');
      
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `rapport_productivite_${this.currentDate.getTime()}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      this.showNotificationMessage('CSV exporté avec succès!', 'success');
    } catch (error) {
      this.showNotificationMessage('Erreur lors de l\'export CSV', 'error');
    }
  }
}