// src/app/pages/manager/task-form/task-form.ts
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

export interface TaskFormData {
  task?: any;
  isReadOnly?: boolean;
}

@Component({
  selector: 'app-task-form',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule
  ],
  templateUrl: './task-form.html',
  styleUrls: ['./task-form.scss']
})
export class TaskFormComponent implements OnInit {
  taskForm!: FormGroup;
  isLoading = false;
  isReadOnly = false;
  title = 'Nouvelle tâche';
  data: any = null;

  priorities = [
    { value: 'LOW', label: 'Basse' },
    { value: 'MEDIUM', label: 'Moyenne' },
    { value: 'HIGH', label: 'Haute' }
  ];

  statuses = [
    { value: 'TODO', label: 'À faire' },
    { value: 'IN_PROGRESS', label: 'En cours' },
    { value: 'DONE', label: 'Terminé' }
  ];

  constructor(
    private fb: FormBuilder,
    private dialogRef: MatDialogRef<TaskFormComponent>
  ) {
    // Récupérer les données passées via dialogRef
    this.data = this.dialogRef?._containerInstance?._config?.data;
    this.isReadOnly = this.data?.isReadOnly || false;
    if (this.data?.task) {
      this.title = 'Modifier la tâche';
    }
  }

  ngOnInit(): void {
    this.initForm();
    if (this.data?.task) {
      this.patchForm();
    }
    if (this.isReadOnly) {
      this.taskForm.disable();
    }
  }

  private initForm(): void {
    this.taskForm = this.fb.group({
      title: ['', [Validators.required, Validators.minLength(3)]],
      description: ['', [Validators.required]],
      priority: ['MEDIUM', [Validators.required]],
      statuts: ['TODO', [Validators.required]],
      due_date: ['', [Validators.required]],
      assigned_to: [null],
      project: [null]
    });
  }

  private patchForm(): void {
    const task = this.data?.task;
    if (!task) return;
    
    this.taskForm.patchValue({
      title: task.title || '',
      description: task.description || '',
      priority: task.priority || 'MEDIUM',
      statuts: task.statuts || 'TODO',
      due_date: task.due_date ? new Date(task.due_date) : null,
      assigned_to: task.assigned_to?.id || null,
      project: task.project?.id || null
    });
  }

  onSubmit(): void {
    if (this.taskForm.invalid) {
      this.taskForm.markAllAsTouched();
      return;
    }

    this.isLoading = true;
    const formValue = this.taskForm.value;
    
    if (formValue.due_date) {
      formValue.due_date = new Date(formValue.due_date).toISOString().split('T')[0];
    }

    this.dialogRef.close(formValue);
  }

  onCancel(): void {
    this.dialogRef.close(null);
  }

  get titleControl() { return this.taskForm.get('title'); }
  get descriptionControl() { return this.taskForm.get('description'); }
  get priorityControl() { return this.taskForm.get('priority'); }
  get statusControl() { return this.taskForm.get('statuts'); }
  get dueDateControl() { return this.taskForm.get('due_date'); }
}