import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';

interface User {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
}

interface Task {
  id: number;
  title: string;
  description: string;
  assigned_to?: User;
  statuts: 'TODO' | 'IN_PROGRESS' | 'DONE';
  priority: 'LOW' | 'MEDIUM' | 'HIGH';
  due_date?: string;
}

interface Project {
  id: number;
  name: string;
  description: string;
  start_date?: string;
  end_date?: string;
  statuts: 'PLANNED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  creator?: User;
  users?: User[];
  tasks: Task[];
}

@Component({
  selector: 'app-project-task-manager',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule],
  templateUrl: './project-task.html',
  styleUrls: ['./project-task.scss']
})
export class ProjectTask {
  // Sample users for assignment
  users: User[] = [
    { id: 1, firstName: 'Alice', lastName: 'Johnson', email: 'alice@test.com' },
    { id: 2, firstName: 'Bob', lastName: 'Smith', email: 'bob@test.com' },
    { id: 3, firstName: 'Charlie', lastName: 'Brown', email: 'charlie@test.com' },
  ];

  // Sample projects
  projects: Project[] = [
    {
      id: 1,
      name: 'Website Redesign',
      description: 'Full redesign of corporate website',
      statuts: 'IN_PROGRESS',
      start_date: '2026-03-01',
      end_date: '2026-06-01',
      tasks: [
        {
          id: 1,
          title: 'Design new homepage',
          description: 'Create wireframes and mockups',
          assigned_to: this.users[0],
          statuts: 'IN_PROGRESS',
          priority: 'HIGH',
          due_date: '2026-04-01'
        },
        {
          id: 2,
          title: 'Update CSS framework',
          description: 'Upgrade to latest version of TailwindCSS',
          statuts: 'TODO',
          priority: 'MEDIUM',
          due_date: '2026-04-15'
        }
      ]
    }
  ];

  showProjectForm = false;
  showTaskForm = false;
  showConfirmModal = false;

  editingProject: Project | null = null;
  editingTask: Task | null = null;
  selectedProject: Project | null = null;

  confirmAction: 'deleteProject' | 'deleteTask' | 'toggleTask' = 'deleteProject';
  selectedItem: Project | Task | null = null;

  // Enumerations
  projectStatuses = ['PLANNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'];
  taskStatuses = ['TODO', 'IN_PROGRESS', 'DONE'];
  taskPriorities = ['LOW', 'MEDIUM', 'HIGH'];

  // --- Project CRUD ---
  openProjectForm(project?: Project) {
    this.editingProject = project ? { ...project } : { id: 0, name: '', description: '', statuts: 'PLANNED', tasks: [] };
    this.showProjectForm = true;
  }

  saveProject() {
    if (!this.editingProject) return;
    if (this.editingProject.id === 0) {
      this.editingProject.id = Date.now();
      this.projects.push(this.editingProject);
    } else {
      const idx = this.projects.findIndex(p => p.id === this.editingProject!.id);
      if (idx > -1) this.projects[idx] = this.editingProject;
    }
    this.showProjectForm = false;
  }

  // --- Task CRUD ---
  openTaskForm(project: Project, task?: Task) {
    this.selectedProject = project;
    this.editingTask = task ? { ...task } : { id: 0, title: '', description: '', statuts: 'TODO', priority: 'MEDIUM' };
    this.showTaskForm = true;
  }

  saveTask() {
    if (!this.selectedProject || !this.editingTask) return;
    if (this.editingTask.id === 0) {
      this.editingTask.id = Date.now();
      this.selectedProject.tasks.push(this.editingTask);
    } else {
      const idx = this.selectedProject.tasks.findIndex(t => t.id === this.editingTask!.id);
      if (idx > -1) this.selectedProject.tasks[idx] = this.editingTask;
    }
    this.showTaskForm = false;
  }

  // --- Confirmation ---
  openConfirm(item: Project | Task, action: 'deleteProject' | 'deleteTask' | 'toggleTask') {
    this.selectedItem = item;
    this.confirmAction = action;
    this.showConfirmModal = true;
  }

  cancelConfirm() {
    this.selectedItem = null;
    this.showConfirmModal = false;
  }

  confirm() {
    if (!this.selectedItem) return;

    if (this.confirmAction === 'deleteProject') {
      this.projects = this.projects.filter(p => p.id !== (this.selectedItem as Project).id);
    } else if (this.confirmAction === 'deleteTask') {
      this.projects.forEach(p => {
        p.tasks = p.tasks.filter(t => t.id !== (this.selectedItem as Task).id);
      });
    } else if (this.confirmAction === 'toggleTask') {
      const task = this.selectedItem as Task;
      task.statuts = task.statuts === 'TODO' ? 'DONE' : task.statuts === 'IN_PROGRESS' ? 'DONE' : 'TODO';
    }

    this.cancelConfirm();
  }

  getConfirmMessage() {
    if (!this.selectedItem) return '';
    if (this.confirmAction === 'deleteProject') return `Are you sure you want to delete project "${(this.selectedItem as Project).name}"?`;
    if (this.confirmAction === 'deleteTask') return `Are you sure you want to delete task "${(this.selectedItem as Task).title}"?`;
    if (this.confirmAction === 'toggleTask') return `Are you sure you want to change status of "${(this.selectedItem as Task).title}"?`;
    return '';
  }

  getConfirmTitle() {
    if (this.confirmAction === 'deleteProject') return 'Delete Project';
    if (this.confirmAction === 'deleteTask') return 'Delete Task';
    return 'Confirm Action';
  }
}