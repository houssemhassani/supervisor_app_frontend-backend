// src/app/pages/manager/project-task/project-task.ts
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
  loadData(): void {
    this.isLoading = true;

    // Récupérer les projets du manager connecté
    this.managerService.getAllProjects().subscribe({
      next: (response) => {
        this.projects = response.data || [];
        console.log(`✅ ${this.projects.length} projets chargés`);
        
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
          }
        });
      },
      error: (error) => {
        console.error('❌ Erreur chargement projets:', error);
        this.isLoading = false;
        this.snackBar.open('Erreur lors du chargement des données', 'Fermer', { duration: 3000 });
      }
    });
  }

  loadUsers(): void {
    // Récupérer les utilisateurs pour l'assignation
    // Cette méthode devrait être implémentée dans le service
    this.managerService.getUsers().subscribe({
      next: (response) => {
        this.users = response.data || [];
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
      this.editingProject = {
        id: 0,
        name: '',
        description: '',
        statuts: 'PLANNED',
        start_date: '',
        end_date: '',
        users: []
      };
    }
    this.showProjectForm = true;
  }

  saveProject(): void {
    if (!this.editingProject) return;

    if (this.editingProject.id === 0) {
      // Créer un nouveau projet
      this.managerService.createProject(this.editingProject).subscribe({
        next: (response) => {
          this.snackBar.open('✅ Projet créé avec succès', 'Fermer', { duration: 3000 });
          this.showProjectForm = false;
          this.loadData();
        },
        error: (error) => {
          console.error('Erreur création projet:', error);
          this.snackBar.open('❌ Erreur lors de la création', 'Fermer', { duration: 3000 });
        }
      });
    } else {
      // Modifier un projet existant
      this.managerService.updateProject(this.editingProject.id, this.editingProject).subscribe({
        next: (response) => {
          this.snackBar.open('✅ Projet modifié avec succès', 'Fermer', { duration: 3000 });
          this.showProjectForm = false;
          this.loadData();
        },
        error: (error) => {
          console.error('Erreur modification projet:', error);
          this.snackBar.open('❌ Erreur lors de la modification', 'Fermer', { duration: 3000 });
        }
      });
    }
  }

  deleteProject(project: Project): void {
    this.managerService.deleteProject(project.id).subscribe({
      next: () => {
        this.snackBar.open('🗑️ Projet supprimé', 'Fermer', { duration: 3000 });
        this.loadData();
      },
      error: (error) => {
        console.error('Erreur suppression projet:', error);
        this.snackBar.open('❌ Erreur lors de la suppression', 'Fermer', { duration: 3000 });
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
      this.editingTask = {
        id: 0,
        title: '',
        description: '',
        statuts: 'TODO',
        priority: 'MEDIUM',
        due_date: '',
        assigned_to: undefined,
        project: { id: project.id, name: project.name }
      };
    }
    this.showTaskForm = true;
  }

  saveTask(): void {
    if (!this.editingTask || !this.selectedProject) return;

    // Assigner le projet à la tâche
    this.editingTask.project = { id: this.selectedProject.id, name: this.selectedProject.name };

    if (this.editingTask.id === 0) {
      // Créer une nouvelle tâche
      this.managerService.createTask(this.editingTask).subscribe({
        next: (response) => {
          this.snackBar.open('✅ Tâche créée avec succès', 'Fermer', { duration: 3000 });
          this.showTaskForm = false;
          this.loadData();
        },
        error: (error) => {
          console.error('Erreur création tâche:', error);
          this.snackBar.open('❌ Erreur lors de la création', 'Fermer', { duration: 3000 });
        }
      });
    } else {
      // Modifier une tâche existante
      this.managerService.updateTask(this.editingTask.id, this.editingTask).subscribe({
        next: (response) => {
          this.snackBar.open('✅ Tâche modifiée avec succès', 'Fermer', { duration: 3000 });
          this.showTaskForm = false;
          this.loadData();
        },
        error: (error) => {
          console.error('Erreur modification tâche:', error);
          this.snackBar.open('❌ Erreur lors de la modification', 'Fermer', { duration: 3000 });
        }
      });
    }
  }

  deleteTask(task: Task): void {
    this.managerService.deleteTask(task.id).subscribe({
      next: () => {
        this.snackBar.open('🗑️ Tâche supprimée', 'Fermer', { duration: 3000 });
        this.loadData();
      },
      error: (error) => {
        console.error('Erreur suppression tâche:', error);
        this.snackBar.open('❌ Erreur lors de la suppression', 'Fermer', { duration: 3000 });
      }
    });
  }

  updateTaskStatus(task: Task, status: string): void {
    this.managerService.updateTaskStatus(task.id, status).subscribe({
      next: () => {
        this.snackBar.open(`✅ Statut mis à jour: ${status}`, 'Fermer', { duration: 2000 });
        this.loadData();
      },
      error: (error) => {
        console.error('Erreur mise à jour statut:', error);
        this.snackBar.open('❌ Erreur lors de la mise à jour', 'Fermer', { duration: 3000 });
      }
    });
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
      const newStatus = task.statuts === 'TODO' ? 'IN_PROGRESS' : 
                        task.statuts === 'IN_PROGRESS' ? 'DONE' : 'TODO';
      this.updateTaskStatus(task, newStatus);
    }

    this.cancelConfirm();
  }

  getConfirmMessage(): string {
    if (!this.selectedItem) return '';
    if (this.confirmAction === 'deleteProject') {
      return `Êtes-vous sûr de vouloir supprimer le projet "${(this.selectedItem as Project).name}" ?`;
    }
    if (this.confirmAction === 'deleteTask') {
      return `Êtes-vous sûr de vouloir supprimer la tâche "${(this.selectedItem as Task).title}" ?`;
    }
    if (this.confirmAction === 'toggleTask') {
      return `Voulez-vous changer le statut de la tâche "${(this.selectedItem as Task).title}" ?`;
    }
    return '';
  }

  getConfirmTitle(): string {
    if (this.confirmAction === 'deleteProject') return 'Supprimer le projet';
    if (this.confirmAction === 'deleteTask') return 'Supprimer la tâche';
    return 'Confirmer l\'action';
  }

  // =========================
  // UTILS
  // =========================
  getProjectTasks(projectId: number): Task[] {
    return this.tasks.filter(task => task.project?.id === projectId);
  }

  getTaskStatusLabel(status: string): string {
    const labels: any = {
      'TODO': 'À faire',
      'IN_PROGRESS': 'En cours',
      'DONE': 'Terminé'
    };
    return labels[status] || status;
  }

  getTaskPriorityLabel(priority: string): string {
    const labels: any = {
      'LOW': 'Basse',
      'MEDIUM': 'Moyenne',
      'HIGH': 'Haute'
    };
    return labels[priority] || priority;
  }

  getProjectStatusLabel(status: string): string {
    const labels: any = {
      'PLANNED': 'Planifié',
      'IN_PROGRESS': 'En cours',
      'COMPLETED': 'Terminé',
      'CANCELLED': 'Annulé'
    };
    return labels[status] || status;
  }

  getStatusIcon(status: string): string {
  const icons: Record<string, string> = {
    // Pour les tâches
    'TODO': 'radio_button_unchecked',
    'IN_PROGRESS': 'play_circle',
    'DONE': 'check_circle',
    // Pour les projets
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
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR');
  }
}