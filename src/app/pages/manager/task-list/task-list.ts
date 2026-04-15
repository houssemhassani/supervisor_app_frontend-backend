// src/app/pages/manager/task-list/task-list.ts
import { Component, Input, Output, EventEmitter, OnInit, OnChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatMenuModule } from '@angular/material/menu';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTooltipModule } from '@angular/material/tooltip';

export interface Task {
  id: number;
  title: string;
  description: string;
  statuts: 'TODO' | 'IN_PROGRESS' | 'DONE';
  priority: 'LOW' | 'MEDIUM' | 'HIGH';
  due_date: string;
  assigned_to?: {
    id: number;
    username: string;
    email: string;
  };
  project?: {
    id: number;
    name: string;
  };
  created_at?: string;
}

@Component({
  selector: 'app-task-list',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatChipsModule,
    MatMenuModule,
    MatProgressBarModule,
    MatTooltipModule
  ],
  templateUrl: './task-list.html',
  styleUrls: ['./task-list.scss']
})
export class TaskListComponent implements OnInit, OnChanges {
  @Input() tasks: Task[] = [];
  @Input() showActions: boolean = true;
  @Input() showUserInfo: boolean = true;
  @Input() showProjectInfo: boolean = true;
  @Input() title: string = 'Tâches';
  @Input() subtitle: string = 'Gestion des tâches';

  @Output() onEdit = new EventEmitter<Task>();
  @Output() onDelete = new EventEmitter<Task>();
  @Output() onView = new EventEmitter<Task>();
  @Output() onStatusChange = new EventEmitter<{ task: Task; status: string }>();

  filteredTasks: Task[] = [];
  searchTerm: string = '';
  selectedStatus: string = 'ALL';
  selectedPriority: string = 'ALL';
  sortBy: string = 'due_date';
  sortOrder: 'asc' | 'desc' = 'asc';

  statuses = [
    { value: 'ALL', label: 'Tous', icon: 'list', color: '#9e9e9e' },
    { value: 'TODO', label: 'À faire', icon: 'pending', color: '#3b82f6' },
    { value: 'IN_PROGRESS', label: 'En cours', icon: 'play_circle', color: '#f59e0b' },
    { value: 'DONE', label: 'Terminé', icon: 'check_circle', color: '#22c55e' }
  ];

  priorities = [
    { value: 'ALL', label: 'Toutes', icon: 'filter_list' },
    { value: 'HIGH', label: 'Haute', icon: 'priority_high', color: '#ef4444' },
    { value: 'MEDIUM', label: 'Moyenne', icon: 'drag_handle', color: '#f59e0b' },
    { value: 'LOW', label: 'Basse', icon: 'low_priority', color: '#22c55e' }
  ];

  ngOnInit(): void {
    this.applyFilters();
  }

  ngOnChanges(): void {
    this.applyFilters();
  }

  applyFilters(): void {
    let filtered = [...this.tasks];

    // Filtre par statut
    if (this.selectedStatus !== 'ALL') {
      filtered = filtered.filter(t => t.statuts === this.selectedStatus);
    }

    // Filtre par priorité
    if (this.selectedPriority !== 'ALL') {
      filtered = filtered.filter(t => t.priority === this.selectedPriority);
    }

    // Filtre par recherche
    if (this.searchTerm.trim()) {
      const term = this.searchTerm.toLowerCase();
      filtered = filtered.filter(t =>
        t.title.toLowerCase().includes(term) ||
        t.description?.toLowerCase().includes(term) ||
        t.assigned_to?.username?.toLowerCase().includes(term)
      );
    }

    // Tri
    filtered.sort((a, b) => {
      let valueA: any;
      let valueB: any;

      switch (this.sortBy) {
        case 'due_date':
          valueA = new Date(a.due_date).getTime();
          valueB = new Date(b.due_date).getTime();
          break;
        case 'priority':
          const priorityOrder = { HIGH: 3, MEDIUM: 2, LOW: 1 };
          valueA = priorityOrder[a.priority];
          valueB = priorityOrder[b.priority];
          break;
        case 'title':
          valueA = a.title.toLowerCase();
          valueB = b.title.toLowerCase();
          return this.sortOrder === 'asc' 
            ? valueA.localeCompare(valueB) 
            : valueB.localeCompare(valueA);
        default:
          return 0;
      }

      return this.sortOrder === 'asc' ? valueA - valueB : valueB - valueA;
    });

    this.filteredTasks = filtered;
  }

  clearFilters(): void {
    this.searchTerm = '';
    this.selectedStatus = 'ALL';
    this.selectedPriority = 'ALL';
    this.sortBy = 'due_date';
    this.sortOrder = 'asc';
    this.applyFilters();
  }

  changeSort(field: string): void {
    if (this.sortBy === field) {
      this.sortOrder = this.sortOrder === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortBy = field;
      this.sortOrder = 'asc';
    }
    this.applyFilters();
  }

  updateStatus(task: Task, status: string): void {
    this.onStatusChange.emit({ task, status });
  }

  getStatusIcon(status: string): string {
    const icons: Record<string, string> = {
      'TODO': 'pending',
      'IN_PROGRESS': 'play_circle',
      'DONE': 'check_circle'
    };
    return icons[status] || 'help';
  }

  getStatusLabel(status: string): string {
    const labels: Record<string, string> = {
      'TODO': 'À faire',
      'IN_PROGRESS': 'En cours',
      'DONE': 'Terminé'
    };
    return labels[status] || status;
  }

  getPriorityIcon(priority: string): string {
    const icons: Record<string, string> = {
      'HIGH': 'priority_high',
      'MEDIUM': 'drag_handle',
      'LOW': 'low_priority'
    };
    return icons[priority] || 'help';
  }

  getPriorityLabel(priority: string): string {
    const labels: Record<string, string> = {
      'HIGH': 'Haute',
      'MEDIUM': 'Moyenne',
      'LOW': 'Basse'
    };
    return labels[priority] || priority;
  }

  formatDate(dateString: string): string {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  }

  isOverdue(dueDate: string): boolean {
    if (!dueDate) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = new Date(dueDate);
    due.setHours(0, 0, 0, 0);
    return due < today;
  }

  getProgressPercentage(): number {
    const total = this.tasks.length;
    if (total === 0) return 0;
    const completed = this.tasks.filter(t => t.statuts === 'DONE').length;
    return (completed / total) * 100;
  }

  getStats(): { total: number; todo: number; inProgress: number; done: number } {
    return {
      total: this.tasks.length,
      todo: this.tasks.filter(t => t.statuts === 'TODO').length,
      inProgress: this.tasks.filter(t => t.statuts === 'IN_PROGRESS').length,
      done: this.tasks.filter(t => t.statuts === 'DONE').length
    };
  }
}