import { Component, OnInit } from '@angular/core';
import { Chart, LineElement, PointElement, LinearScale, Title, CategoryScale, Tooltip, Legend } from 'chart.js';
import jsPDF from 'jspdf';

// 🔹 Enregistrer Chart.js
Chart.register(LineElement, PointElement, LinearScale, Title, CategoryScale, Tooltip, Legend);

// Interfaces
interface User {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
}

interface ActivityReport {
  user: User;
  report_date: string;
  total_work_time: number;
  total_keyboards_clicks: number;
  total_mouse_clicks: number;
  screenshots_count: number;
  productivity_score: number;
}

@Component({
  selector: 'app-productivity-dashboard',
  templateUrl: './productivity-dashboard.html',
  styleUrls: ['./productivity-dashboard.scss']
})
export class ProductivityDashboard implements OnInit {

  reports: ActivityReport[] = [];
  filteredReports: ActivityReport[] = [];
  chart: any;
  filterPeriod: 'daily' | 'weekly' | 'monthly' = 'daily';

  users: User[] = [
    { id: 1, firstName: 'Alice', lastName: 'Johnson', email: 'alice@test.com' },
    { id: 2, firstName: 'Bob', lastName: 'Smith', email: 'bob@test.com' },
    { id: 3, firstName: 'Charlie', lastName: 'Brown', email: 'charlie@test.com' },
  ];

  ngOnInit() {
    this.fetchReports();
  }

  // 🔹 Simuler récupération des rapports
  fetchReports() {
    const today = new Date();
    this.reports = this.users.map((u, i) => ({
      user: u,
      report_date: today.toISOString().split('T')[0],
      total_work_time: 6 + i,
      total_keyboards_clicks: 1200 + i * 100,
      total_mouse_clicks: 800 + i * 50,
      screenshots_count: 10 + i,
      productivity_score: Math.round(Math.random() * 100)
    }));
    this.applyFilter();
    this.renderChart();
  }

  // 🔹 Filtrer par période
  applyFilter() {
    // Ici, filtrage simulé (à adapter avec backend)
    this.filteredReports = this.reports; 
  }

  // 🔹 Créer graphique
  renderChart() {
    if (this.chart) this.chart.destroy();
    this.chart = new Chart('productivityChart', {
      type: 'line',
      data: {
        labels: this.filteredReports.map(r => r.user.firstName),
        datasets: [{
          label: 'AI Productivity Score',
          data: this.filteredReports.map(r => r.productivity_score),
          borderColor: '#4f46e5',
          backgroundColor: 'rgba(79,70,229,0.2)',
          fill: true,
          tension: 0.4
        }]
      },
      options: {
        responsive: true,
        plugins: {
          title: { display: true, text: 'Employee Productivity' },
          legend: { display: true }
        },
        scales: {
          y: { beginAtZero: true, max: 100 }
        }
      }
    });
  }

  // 🔹 Changer période
  changePeriod(period: 'daily' | 'weekly' | 'monthly') {
    this.filterPeriod = period;
    this.applyFilter();
    this.renderChart();
  }

  // 🔹 Export PDF
  downloadPDF() {
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text('Productivity Report', 10, 10);

    // Ajouter graphique
    const canvas = document.getElementById('productivityChart') as HTMLCanvasElement;
    if (canvas) {
      const imgData = canvas.toDataURL('image/png');
      doc.addImage(imgData, 'PNG', 10, 20, 180, 100);
    }

    // Ajouter tableau
    doc.setFontSize(12);
    let y = 130;
    this.filteredReports.forEach(r => {
      doc.text(
        `${r.user.firstName} ${r.user.lastName} - Score: ${r.productivity_score}%`, 
        10, y
      );
      y += 10;
    });

    doc.save('productivity_report.pdf');
  }
}