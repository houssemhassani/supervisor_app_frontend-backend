import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ManagerService, Project, Task, User } from '../../../services/manager';
import { forkJoin } from 'rxjs';

// Définition du type pour le mode d'affichage
type ViewMode = 'list' | 'kanban';

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
  
  // View mode: 'list' ou 'kanban'
  viewMode: ViewMode = 'list';
  selectedProjectForKanban: Project | null = null;

  editingProject: Project | null = null;
  editingTask: Task | null = null;
  selectedProject: Project | null = null;

  confirmAction: 'deleteProject' | 'deleteTask' | 'toggleTask' = 'deleteProject';
  selectedItem: any = null;

  // Enumerations
  projectStatuses = ['PLANNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'];
  taskStatuses = ['TODO', 'IN_PROGRESS', 'DONE'];
  taskPriorities = ['LOW', 'MEDIUM', 'HIGH'];

  // Colonnes Kanban
  kanbanColumns = [
    { status: 'TODO', title: 'À faire', icon: 'pending', color: '#f59e0b' },
    { status: 'IN_PROGRESS', title: 'En cours', icon: 'play_circle', color: '#3b82f6' },
    { status: 'DONE', title: 'Terminé', icon: 'check_circle', color: '#10b981' }
  ];

  constructor(
    private managerService: ManagerService,
    private snackBar: MatSnackBar,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadData();
    this.loadUsers();
  }

  // =========================
  // UTILITAIRES
  // =========================

  getTextFromBlocks(blocks: any): string {
    if (!blocks) return '';
    if (typeof blocks === 'string') return blocks;
    if (Array.isArray(blocks)) {
      return blocks.map(block => {
        if (block.children) {
          return block.children.map((child: any) => child.text || '').join('');
        }
        return '';
      }).join(' ');
    }
    return '';
  }

  private uniqueBy<T extends { id: number }>(array: T[]): T[] {
    const seen = new Set<number>();
    return array.filter(item => {
      if (seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    });
  }

  // =========================
  // VIEW MODE - Méthodes utilitaires
  // =========================

  isListMode(): boolean {
    return this.viewMode === 'list';
  }

  isKanbanMode(): boolean {
    return this.viewMode === 'kanban';
  }

  setViewMode(mode: ViewMode): void {
    this.viewMode = mode;
    if (mode === 'list') {
      this.selectedProjectForKanban = null;
    }
    this.cdr.detectChanges();
  }
  
  selectProjectForKanban(project: Project): void {
    const fullProject = this.projects.find(p => p.id === project.id);
    if (fullProject) {
      this.selectedProjectForKanban = fullProject;
      console.log('📋 Projet sélectionné:', this.selectedProjectForKanban.name);
      console.log('📊 Nombre de tâches:', this.selectedProjectForKanban.tasks?.length || 0);
    } else {
      this.selectedProjectForKanban = project;
    }
    this.viewMode = 'kanban';
    this.cdr.detectChanges();
  }
  
  backToList(): void {
    this.viewMode = 'list';
    this.selectedProjectForKanban = null;
    this.cdr.detectChanges();
  }
  
  getTasksByStatus(projectId: number, status: string): Task[] {
    const project = this.projects.find(p => p.id === projectId);
    if (project && project.tasks) {
      return project.tasks.filter(task => task.statuts === status);
    }
    return [];
  }

  // =========================
  // LOAD DATA - VERSION CORRIGÉE
  // =========================

  loadData(): void {
    this.isLoading = true;
    this.cdr.detectChanges();
    
    forkJoin({
      projects: this.managerService.getAllProjects(),
      tasks: this.managerService.getAllTasks()
    }).subscribe({
      next: (result: any) => {
        console.log('📦 Réponse projets:', result.projects);
        console.log('📦 Réponse tâches:', result.tasks);
        
        // Traitement des projets
        let rawProjects = [];
        const projectsResponse = result.projects;
        
        if (projectsResponse.data && Array.isArray(projectsResponse.data)) {
          rawProjects = projectsResponse.data;
        } else if (projectsResponse.data && projectsResponse.data.data && Array.isArray(projectsResponse.data.data)) {
          rawProjects = projectsResponse.data.data;
        } else if (Array.isArray(projectsResponse)) {
          rawProjects = projectsResponse;
        }
        
        this.projects = rawProjects.map((item: any) => {
          // Format Strapi v4 (avec attributes)
          if (item.attributes) {
            return {
              id: item.id,
              name: item.attributes.name,
              description: item.attributes.description,
              statuts: item.attributes.statuts,
              start_date: item.attributes.start_date,
              end_date: item.attributes.end_date,
              users: item.attributes.users || [],
              creator: item.attributes.creator,
              tasks: item.attributes.tasks || []
            };
          }
          // Format Strapi v5 (direct)
          return {
            id: item.id,
            name: item.name,
            description: item.description,
            statuts: item.statuts,
            start_date: item.start_date,
            end_date: item.end_date,
            users: item.users || [],
            creator: item.creator,
            tasks: item.tasks || []
          };
        });
        
        // Éliminer les doublons
        this.projects = this.uniqueBy(this.projects);
        
        // Traitement des tâches
        let rawTasks = [];
        const tasksResponse = result.tasks;
        
        if (tasksResponse.data && Array.isArray(tasksResponse.data)) {
          rawTasks = tasksResponse.data;
        } else if (tasksResponse.data && tasksResponse.data.data && Array.isArray(tasksResponse.data.data)) {
          rawTasks = tasksResponse.data.data;
        } else if (Array.isArray(tasksResponse)) {
          rawTasks = tasksResponse;
        }
        
        this.tasks = rawTasks.map((item: any) => {
          if (item.attributes) {
            return {
              id: item.id,
              title: item.attributes.title,
              description: item.attributes.description,
              statuts: item.attributes.statuts,
              priority: item.attributes.priority,
              due_date: item.attributes.due_date,
              assigned_to: item.attributes.assigned_to,
              project: item.attributes.project
            };
          }
          return {
            id: item.id,
            title: item.title,
            description: item.description,
            statuts: item.statuts,
            priority: item.priority,
            due_date: item.due_date,
            assigned_to: item.assigned_to,
            project: item.project
          };
        });
        
        // Éliminer les doublons de tâches
        this.tasks = this.uniqueBy(this.tasks);
        
        // SI LES TÂCHES NE SONT PAS DANS LES PROJETS, ON LES ASSOCIE
        if (this.projects.length > 0 && this.tasks.length > 0) {
          const hasTasksInProjects = this.projects.some(p => p.tasks && p.tasks.length > 0);
          if (!hasTasksInProjects) {
            console.log('🔄 Association des tâches aux projets...');
            this.projects = this.projects.map(project => {
              const projectTasks = this.tasks.filter(task => task.project?.id === project.id);
              return { ...project, tasks: projectTasks };
            });
          }
        }
        
        console.log('✅ Résultat final:');
        this.projects.forEach(p => {
          console.log(`   ${p.name}: ${p.tasks?.length || 0} tâches`);
        });
        
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error('❌ Erreur:', error);
        this.isLoading = false;
        this.cdr.detectChanges();
        this.snackBar.open('Erreur lors du chargement des données', 'Fermer', { duration: 4000 });
      }
    });
  }

  loadUsers(): void {
    this.managerService.getUsers().subscribe({
      next: (response) => {
        this.users = response.data || [];
        this.cdr.detectChanges();
      },
      error: (error) => console.error('Erreur chargement utilisateurs:', error)
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
    this.cdr.detectChanges();
  }

  closeProjectForm(): void {
    this.showProjectForm = false;
    this.editingProject = null;
    this.cdr.detectChanges();
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
          console.error(error);
          this.snackBar.open('❌ Erreur lors de la création', 'Fermer', { duration: 3000 });
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
          console.error(error);
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
        console.error(error);
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
    this.cdr.detectChanges();
  }

  closeTaskForm(): void {
    this.showTaskForm = false;
    this.editingTask = null;
    this.selectedProject = null;
    this.cdr.detectChanges();
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
          this.snackBar.open('✅ Tâche créée', 'Fermer', { duration: 3000 });
          this.closeTaskForm();
          this.loadData();
        },
        error: (error) => {
          console.error(error);
          this.snackBar.open('❌ Erreur lors de la création', 'Fermer', { duration: 3000 });
        }
      });
    } else {
      this.managerService.updateTask(this.editingTask.id, taskData).subscribe({
        next: () => {
          this.snackBar.open('✅ Tâche modifiée', 'Fermer', { duration: 3000 });
          this.closeTaskForm();
          this.loadData();
        },
        error: (error) => {
          console.error(error);
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
        console.error(error);
        this.snackBar.open('❌ Erreur lors de la suppression', 'Fermer', { duration: 3000 });
      }
    });
  }

  updateTaskStatus(task: Task, newStatus: string): void {
    if (!task || task.statuts === newStatus) return;
    
    const oldStatus = task.statuts;
    task.statuts = newStatus as "TODO" | "IN_PROGRESS" | "DONE";
    
    this.managerService.updateTaskStatus(task.id, newStatus).subscribe({
      next: () => {
        this.snackBar.open(`✅ Tâche déplacée vers ${this.getTaskStatusLabel(newStatus)}`, 'Fermer', { duration: 2000 });
        this.loadData();
      },
      error: (error) => {
        console.error(error);
        task.statuts = oldStatus;
        this.snackBar.open('❌ Erreur lors du déplacement', 'Fermer', { duration: 3000 });
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
    this.cdr.detectChanges();
  }

  cancelConfirm(): void {
    this.selectedItem = null;
    this.showConfirmModal = false;
    this.cdr.detectChanges();
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
      return `Supprimer le projet "${(this.selectedItem as Project).name}" ?`;
    }
    if (this.confirmAction === 'deleteTask') {
      return `Supprimer la tâche "${(this.selectedItem as Task).title}" ?`;
    }
    return 'Confirmer cette action ?';
  }

  getConfirmTitle(): string {
    if (this.confirmAction === 'deleteProject') return 'Supprimer le projet';
    if (this.confirmAction === 'deleteTask') return 'Supprimer la tâche';
    return 'Confirmer';
  }

  // =========================
  // UTILS
  // =========================

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

  formatDate(dateString: string): string {
    if (!dateString) return '';
    try {
      return new Date(dateString).toLocaleDateString('fr-FR');
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
  
  trackProjectById(index: number, project: Project): number {
    return project.id;
  }

  trackTaskById(index: number, task: Task): number {
    return task.id;
  }
}