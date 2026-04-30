import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ManagerService, Project, Task, User } from '../../../services/manager';

@Component({
  selector: 'app-project-task',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, MatButtonModule, MatProgressSpinnerModule],
  templateUrl: './project-task.html',
  styleUrls: ['./project-task.scss']
})
export class ProjectTaskComponent implements OnInit {
  // Data
  projects: Project[] = [];
  tasks: Task[] = [];
  users: User[] = [];

  // UI State
  isLoading = true;
  showProjectForm = false;
  showTaskForm = false;
  showConfirmModal = false;

  editingProject: Project | null = null;
  editingTask: Task | null = null;
  selectedProject: Project | null = null;

  confirmAction: 'deleteProject' | 'deleteTask' | 'toggleTask' = 'deleteProject';
  selectedItem: any = null;

  // Enumerations
  projectStatuses = ['PLANNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'];
  taskStatuses = ['TODO', 'IN_PROGRESS', 'DONE'];
  taskPriorities = ['LOW', 'MEDIUM', 'HIGH'];

  constructor(
    private managerService: ManagerService,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    this.loadData();
    this.loadUsers();
  }

  // =========================
  // LOAD DATA
  // =========================
  // Dans loadData() du project-task.ts
loadData(): void {
  this.isLoading = true;

  console.log('🔄 Chargement des projets...');
  
  // Récupérer les projets
  this.managerService.getAllProjects().subscribe({
    next: (response) => {
      console.log('📦 Réponse complète projets:', response);
      this.projects = response.data || [];
      console.log(`✅ ${this.projects.length} projets chargés`, this.projects);
      
      // Récupérer toutes les tâches
      this.managerService.getAllTasks().subscribe({
        next: (taskResponse) => {
          this.tasks = taskResponse.data || [];
          console.log(`✅ ${this.tasks.length} tâches chargées`);
          this.isLoading = false;
        },
        error: (error) => {
          console.error('❌ Erreur chargement tâches:', error);
          this.isLoading = false;
          this.snackBar.open('Erreur lors du chargement des tâches', 'Fermer', { duration: 3000 });
        }
      });
    },
    error: (error) => {
      console.error('❌ Erreur chargement projets:', error);
      console.log('Détail erreur:', error);
      this.isLoading = false;
      this.snackBar.open('Erreur lors du chargement des projets', 'Fermer', { duration: 3000 });
    }
  });
}

  loadUsers(): void {
    this.managerService.getUsers().subscribe({
      next: (response) => {
        this.users = response.data || [];
        console.log(`✅ ${this.users.length} utilisateurs chargés`);
      },
      error: (error) => {
        console.error('Erreur chargement utilisateurs:', error);
      }
    });
  }

  // =========================
  // PROJECT CRUD
  // =========================
  openProjectForm(project?: Project): void {
    if (project) {
      this.editingProject = { ...project };
    } else {
      const today = new Date().toISOString().split('T')[0];
      const nextMonth = new Date();
      nextMonth.setMonth(nextMonth.getMonth() + 1);
      const nextMonthStr = nextMonth.toISOString().split('T')[0];
      
      this.editingProject = {
        id: 0,
        name: '',
        description: '',
        statuts: 'PLANNED',
        start_date: today,
        end_date: nextMonthStr,
        users: []
      };
    }
    this.showProjectForm = true;
  }

  closeProjectForm(): void {
    this.showProjectForm = false;
    this.editingProject = null;
  }

  saveProject(): void {
    if (!this.editingProject) return;

    const projectData = {
      name: this.editingProject.name,
      description: this.editingProject.description,
      statuts: this.editingProject.statuts,
      start_date: this.editingProject.start_date,
      end_date: this.editingProject.end_date
    };

    if (this.editingProject.id === 0) {
      this.managerService.createProject(projectData).subscribe({
        next: () => {
          this.snackBar.open('✅ Projet créé avec succès', 'Fermer', { duration: 3000 });
          this.closeProjectForm();
          this.loadData();
        },
        error: (error) => {
          console.error('Erreur création projet:', error);
          this.snackBar.open('❌ Erreur lors de la création du projet', 'Fermer', { duration: 3000 });
        }
      });
    } else {
      this.managerService.updateProject(this.editingProject.id, projectData).subscribe({
        next: () => {
          this.snackBar.open('✅ Projet modifié avec succès', 'Fermer', { duration: 3000 });
          this.closeProjectForm();
          this.loadData();
        },
        error: (error) => {
          console.error('Erreur modification projet:', error);
          this.snackBar.open('❌ Erreur lors de la modification du projet', 'Fermer', { duration: 3000 });
        }
      });
    }
  }

  deleteProject(project: Project): void {
    this.managerService.deleteProject(project.id).subscribe({
      next: () => {
        this.snackBar.open('🗑️ Projet supprimé avec succès', 'Fermer', { duration: 3000 });
        this.loadData();
      },
      error: (error) => {
        console.error('Erreur suppression projet:', error);
        this.snackBar.open('❌ Erreur lors de la suppression du projet', 'Fermer', { duration: 3000 });
      }
    });
  }

  // =========================
  // TASK CRUD
  // =========================
  openTaskForm(project: Project, task?: Task): void {
    this.selectedProject = project;
    
    if (task) {
      this.editingTask = { ...task };
    } else {
      const today = new Date().toISOString().split('T')[0];
      const nextWeek = new Date();
      nextWeek.setDate(nextWeek.getDate() + 7);
      const nextWeekStr = nextWeek.toISOString().split('T')[0];
      
      this.editingTask = {
        id: 0,
        title: '',
        description: '',
        statuts: 'TODO',
        priority: 'MEDIUM',
        due_date: nextWeekStr,
        assigned_to: undefined,
        project: { id: project.id, name: project.name }
      };
    }
    this.showTaskForm = true;
  }

  closeTaskForm(): void {
    this.showTaskForm = false;
    this.editingTask = null;
    this.selectedProject = null;
  }

  saveTask(): void {
    if (!this.editingTask || !this.selectedProject) return;

    const taskData: any = {
      title: this.editingTask.title,
      description: this.editingTask.description,
      statuts: this.editingTask.statuts,
      priority: this.editingTask.priority,
      due_date: this.editingTask.due_date,
      project: this.selectedProject.id
    };

    if (this.editingTask.assigned_to) {
      taskData.assigned_to = this.editingTask.assigned_to.id;
    }

    if (this.editingTask.id === 0) {
      this.managerService.createTask(taskData).subscribe({
        next: () => {
          this.snackBar.open('✅ Tâche créée avec succès', 'Fermer', { duration: 3000 });
          this.closeTaskForm();
          this.loadData();
        },
        error: (error) => {
          console.error('Erreur création tâche:', error);
          this.snackBar.open('❌ Erreur lors de la création de la tâche', 'Fermer', { duration: 3000 });
        }
      });
    } else {
      this.managerService.updateTask(this.editingTask.id, taskData).subscribe({
        next: () => {
          this.snackBar.open('✅ Tâche modifiée avec succès', 'Fermer', { duration: 3000 });
          this.closeTaskForm();
          this.loadData();
        },
        error: (error) => {
          console.error('Erreur modification tâche:', error);
          this.snackBar.open('❌ Erreur lors de la modification de la tâche', 'Fermer', { duration: 3000 });
        }
      });
    }
  }

  deleteTask(task: Task): void {
    this.managerService.deleteTask(task.id).subscribe({
      next: () => {
        this.snackBar.open('🗑️ Tâche supprimée avec succès', 'Fermer', { duration: 3000 });
        this.loadData();
      },
      error: (error) => {
        console.error('Erreur suppression tâche:', error);
        this.snackBar.open('❌ Erreur lors de la suppression de la tâche', 'Fermer', { duration: 3000 });
      }
    });
  }

  updateTaskStatus(task: Task, newStatus: string): void {
    if (!task || task.statuts === newStatus) return;
    
    this.managerService.updateTaskStatus(task.id, newStatus).subscribe({
      next: () => {
        this.snackBar.open(`✅ Statut mis à jour: ${this.getTaskStatusLabel(newStatus)}`, 'Fermer', { duration: 2000 });
        this.loadData();
      },
      error: (error) => {
        console.error('Erreur mise à jour statut:', error);
        this.snackBar.open('❌ Erreur lors de la mise à jour du statut', 'Fermer', { duration: 3000 });
      }
    });
  }

  getNextStatus(currentStatus: string): string {
    const statusFlow: Record<string, string> = {
      'TODO': 'IN_PROGRESS',
      'IN_PROGRESS': 'DONE',
      'DONE': 'DONE'
    };
    return statusFlow[currentStatus] || currentStatus;
  }

  // =========================
  // CONFIRMATION MODAL
  // =========================
  openConfirm(item: any, action: 'deleteProject' | 'deleteTask' | 'toggleTask'): void {
    this.selectedItem = item;
    this.confirmAction = action;
    this.showConfirmModal = true;
  }

  cancelConfirm(): void {
    this.selectedItem = null;
    this.showConfirmModal = false;
  }

  confirm(): void {
    if (!this.selectedItem) return;

    if (this.confirmAction === 'deleteProject') {
      this.deleteProject(this.selectedItem as Project);
    } else if (this.confirmAction === 'deleteTask') {
      this.deleteTask(this.selectedItem as Task);
    } else if (this.confirmAction === 'toggleTask') {
      const task = this.selectedItem as Task;
      const newStatus = this.getNextStatus(task.statuts);
      this.updateTaskStatus(task, newStatus);
    }

    this.cancelConfirm();
  }

  getConfirmMessage(): string {
    if (!this.selectedItem) return '';
    if (this.confirmAction === 'deleteProject') {
      return `Êtes-vous sûr de vouloir supprimer le projet "${(this.selectedItem as Project).name}" ? Cette action est irréversible.`;
    }
    if (this.confirmAction === 'deleteTask') {
      return `Êtes-vous sûr de vouloir supprimer la tâche "${(this.selectedItem as Task).title}" ? Cette action est irréversible.`;
    }
    if (this.confirmAction === 'toggleTask') {
      const task = this.selectedItem as Task;
      const nextStatus = this.getNextStatus(task.statuts);
      return `Voulez-vous changer le statut de la tâche "${task.title}" de "${this.getTaskStatusLabel(task.statuts)}" vers "${this.getTaskStatusLabel(nextStatus)}" ?`;
    }
    return '';
  }

  getConfirmTitle(): string {
    if (this.confirmAction === 'deleteProject') return 'Supprimer le projet';
    if (this.confirmAction === 'deleteTask') return 'Supprimer la tâche';
    return 'Changer le statut';
  }

  // =========================
  // UTILS
  // =========================
  getProjectTasks(projectId: number): Task[] {
    return this.tasks.filter(task => task.project?.id === projectId);
  }

  getTaskStatusLabel(status: string): string {
    const labels: Record<string, string> = {
      'TODO': 'À faire',
      'IN_PROGRESS': 'En cours',
      'DONE': 'Terminé'
    };
    return labels[status] || status;
  }

  getTaskPriorityLabel(priority: string): string {
    const labels: Record<string, string> = {
      'LOW': 'Basse',
      'MEDIUM': 'Moyenne',
      'HIGH': 'Haute'
    };
    return labels[priority] || priority;
  }

  getProjectStatusLabel(status: string): string {
    const labels: Record<string, string> = {
      'PLANNED': 'Planifié',
      'IN_PROGRESS': 'En cours',
      'COMPLETED': 'Terminé',
      'CANCELLED': 'Annulé'
    };
    return labels[status] || status;
  }

  getStatusIcon(status: string): string {
    const icons: Record<string, string> = {
      'TODO': 'radio_button_unchecked',
      'IN_PROGRESS': 'play_circle',
      'DONE': 'check_circle',
      'PLANNED': 'schedule',
      'COMPLETED': 'check_circle',
      'CANCELLED': 'cancel'
    };
    return icons[status] || 'help';
  }

  getPriorityClass(priority: string): string {
    return priority.toLowerCase();
  }

  formatDate(dateString: string): string {
    if (!dateString) return '';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('fr-FR');
    } catch {
      return dateString;
    }
  }

  isOverdue(dueDate: string): boolean {
    if (!dueDate) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = new Date(dueDate);
    due.setHours(0, 0, 0, 0);
    return due < today;
  }

  refresh(): void {
    this.loadData();
    this.loadUsers();
  }
}