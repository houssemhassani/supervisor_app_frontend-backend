// leave-request-list.component.ts
import { Component, Input, Output, EventEmitter, OnInit, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { LeaveRequest } from '../../../services/manager';

@Component({
  selector: 'app-leave-request-list',
  templateUrl: './leave-request-list.html',
  styleUrls: ['./leave-request-list.scss'],
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatIconModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatTooltipModule,
    MatProgressBarModule,
    MatDatepickerModule,
    MatNativeDateModule
  ]
})
export class LeaveRequestListComponent implements OnInit, OnChanges {
  @Input() title: string = 'Demandes de congé';
  @Input() requests: LeaveRequest[] = [];
  @Input() showActions: boolean = true;
  @Input() showManagerActions: boolean = false;
  @Input() showUserInfo: boolean = true;
  @Input() showFilters: boolean = true;
  @Input() showStats: boolean = true;
  @Input() showPagination: boolean = true;
  @Input() pageSize: number = 10;
  
  @Output() onEdit = new EventEmitter<LeaveRequest>();
  @Output() onDelete = new EventEmitter<LeaveRequest>();
  @Output() onApprove = new EventEmitter<LeaveRequest>();
  @Output() onReject = new EventEmitter<LeaveRequest>();
  @Output() onViewDetails = new EventEmitter<LeaveRequest>();
  @Output() onCancel = new EventEmitter<LeaveRequest>();
  @Output() onFilteredChange = new EventEmitter<LeaveRequest[]>();

  // Filtres
  filteredRequests: LeaveRequest[] = [];
  selectedStatus: string = 'ALL';
  searchTerm: string = '';
  selectedType: string = 'ALL';
  dateRange: { start: Date | null; end: Date | null } = { start: null, end: null };
  
  // Pagination
  paginatedRequests: LeaveRequest[] = [];
  currentPage: number = 1;
  totalPages: number = 1;
  
  // Types de congés pour le filtre
  leaveTypes = [
    { value: 'ALL', label: 'Tous les types' },
    { value: 'ANNUAL', label: 'Congés annuels' },
    { value: 'SICK', label: 'Congés maladie' },
    { value: 'PERSONAL', label: 'Congés personnels' },
    { value: 'UNPAID', label: 'Sans solde' },
    { value: 'MATERNITY', label: 'Maternité' },
    { value: 'OTHER', label: 'Autre' }
  ];
  
  // Statuts pour le filtre
  statuses = [
    { value: 'ALL', label: 'Tous', icon: 'list', color: '#9e9e9e' },
    { value: 'PENDING', label: 'En attente', icon: 'hourglass_empty', color: '#ff9800' },
    { value: 'APPROVED', label: 'Approuvées', icon: 'check_circle', color: '#4caf50' },
    { value: 'REJECTED', label: 'Rejetées', icon: 'cancel', color: '#f44336' },
    { value: 'CANCELLED', label: 'Annulées', icon: 'block', color: '#9e9e9e' }
  ];

  // Options de tri
  sortBy: string = 'created_at';
  sortOrder: 'asc' | 'desc' = 'desc';
  
  // État du chargement
  isLoading: boolean = false;
  
  // Tooltip texts
  tooltipTexts = {
    edit: 'Modifier la demande (uniquement si en attente)',
    delete: 'Supprimer la demande (action irréversible)',
    approve: 'Approuver la demande',
    reject: 'Rejeter la demande',
    view: 'Voir les détails de la demande',
    cancel: 'Annuler la demande'
  };

  constructor() { }

  ngOnInit(): void {
    this.applyFilters();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['requests'] && !changes['requests'].firstChange) {
      this.applyFilters();
    }
  }

  applyFilters(): void {
    let filtered = [...this.requests];
    
    // Filtre par statut
    if (this.selectedStatus !== 'ALL') {
      filtered = filtered.filter(r => r.statuts === this.selectedStatus);
    }
    
    // Filtre par type de congé
    if (this.selectedType !== 'ALL') {
      filtered = filtered.filter(r => r.type === this.selectedType);
    }
    
    // Filtre par recherche (nom, email, raison)
    if (this.searchTerm.trim()) {
      const term = this.searchTerm.toLowerCase();
      filtered = filtered.filter(r => 
        r.user?.username?.toLowerCase().includes(term) ||
        r.user?.email?.toLowerCase().includes(term) ||
        r.reason?.toLowerCase().includes(term) ||
        this.getStatusLabel(r.statuts).toLowerCase().includes(term)
      );
    }
    
    // Filtre par plage de dates
    if (this.dateRange.start) {
      filtered = filtered.filter(r => new Date(r.start_date) >= this.dateRange.start!);
    }
    if (this.dateRange.end) {
      filtered = filtered.filter(r => new Date(r.end_date) <= this.dateRange.end!);
    }
    
    // Tri
    filtered = this.sortRequests(filtered);
    
    this.filteredRequests = filtered;
    this.onFilteredChange.emit(this.filteredRequests);
    
    // Pagination
    this.totalPages = Math.ceil(this.filteredRequests.length / this.pageSize);
    this.currentPage = 1;
    this.updatePaginatedRequests();
  }

  sortRequests(requests: LeaveRequest[]): LeaveRequest[] {
    return requests.sort((a, b) => {
      let valueA: any;
      let valueB: any;
      
      switch (this.sortBy) {
        case 'created_at':
          valueA = new Date(a.created_at || 0).getTime();
          valueB = new Date(b.created_at || 0).getTime();
          break;
        case 'start_date':
          valueA = new Date(a.start_date).getTime();
          valueB = new Date(b.start_date).getTime();
          break;
        case 'duration_days':
          valueA = a.duration_days || 0;
          valueB = b.duration_days || 0;
          break;
        case 'user':
          valueA = a.user?.username || a.user?.email || '';
          valueB = b.user?.username || b.user?.email || '';
          return this.sortOrder === 'asc' 
            ? valueA.localeCompare(valueB) 
            : valueB.localeCompare(valueA);
        default:
          return 0;
      }
      
      return this.sortOrder === 'asc' ? valueA - valueB : valueB - valueA;
    });
  }

  updatePaginatedRequests(): void {
    const start = (this.currentPage - 1) * this.pageSize;
    const end = start + this.pageSize;
    this.paginatedRequests = this.filteredRequests.slice(start, end);
  }

  changePage(page: number): void {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
      this.updatePaginatedRequests();
    }
  }

  changeSort(field: string): void {
    if (this.sortBy === field) {
      this.sortOrder = this.sortOrder === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortBy = field;
      this.sortOrder = 'desc';
    }
    this.applyFilters();
  }

  clearFilters(): void {
    this.selectedStatus = 'ALL';
    this.selectedType = 'ALL';
    this.searchTerm = '';
    this.dateRange = { start: null, end: null };
    this.sortBy = 'created_at';
    this.sortOrder = 'desc';
    this.applyFilters();
  }

  getStatusCount(status: string): number {
    return this.requests.filter(r => r.statuts === status).length;
  }

  getTypeIcon(type: string): string {
    const icons: {[key: string]: string} = {
      'ANNUAL': 'beach_access',
      'SICK': 'local_hospital',
      'PERSONAL': 'person',
      'UNPAID': 'money_off',
      'MATERNITY': 'baby_changing_station',
      'OTHER': 'more_horiz'
    };
    return icons[type] || 'event';
  }

  getTypeLabel(type: string): string {
    const labels: {[key: string]: string} = {
      'ANNUAL': 'Congés annuels',
      'SICK': 'Congés maladie',
      'PERSONAL': 'Congés personnels',
      'UNPAID': 'Sans solde',
      'MATERNITY': 'Maternité',
      'OTHER': 'Autre'
    };
    return labels[type] || type;
  }

  getStatusLabel(status: string): string {
    const labels: {[key: string]: string} = {
      'PENDING': 'En attente',
      'APPROVED': 'Approuvée',
      'REJECTED': 'Rejetée',
      'CANCELLED': 'Annulée'
    };
    return labels[status] || status;
  }

  getStatusIcon(status: string): string {
    const icons: {[key: string]: string} = {
      'PENDING': 'hourglass_empty',
      'APPROVED': 'check_circle',
      'REJECTED': 'cancel',
      'CANCELLED': 'block'
    };
    return icons[status] || 'help';
  }

  formatDate(date: string): string {
    if (!date) return '';
    return new Date(date).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  }

  formatDateTime(date: string): string {
    if (!date) return '';
    return new Date(date).toLocaleString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  getInitials(name: string): string {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
  }

  getRandomColor(email: string): string {
    let hash = 0;
    for (let i = 0; i < email.length; i++) {
      hash = email.charCodeAt(i) + ((hash << 5) - hash);
    }
    const color = Math.abs(hash % 16777215).toString(16);
    return color.padStart(6, '0');
  }

  getProgressValue(): number {
    const total = this.requests.length;
    if (total === 0) return 0;
    const approved = this.getStatusCount('APPROVED');
    return (approved / total) * 100;
  }

  canEdit(request: LeaveRequest): boolean {
    return request.statuts === 'PENDING';
  }

  canDelete(request: LeaveRequest): boolean {
    return request.statuts === 'PENDING';
  }

  canCancel(request: LeaveRequest): boolean {
    return request.statuts === 'PENDING';
  }

  getPageNumbers(): number[] {
    const pages: number[] = [];
    const maxVisible = 5;
    let start = Math.max(1, this.currentPage - Math.floor(maxVisible / 2));
    let end = Math.min(this.totalPages, start + maxVisible - 1);
    
    if (end - start + 1 < maxVisible) {
      start = Math.max(1, end - maxVisible + 1);
    }
    
    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
    return pages;
  }

  onFilterChange(): void {
    this.applyFilters();
  }

  onDateRangeChange(): void {
    this.applyFilters();
  }
}