// src/app/pages/manager/project-form/project-form.ts
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

export interface ProjectFormData {
  project?: any;
  isReadOnly?: boolean;
}

@Component({
  selector: 'app-project-form',
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
  templateUrl: './project-form.html',
  styleUrls: ['./project-form.scss']
})
export class ProjectFormComponent implements OnInit {
  projectForm!: FormGroup;
  isLoading = false;
  isReadOnly = false;
  title = 'Nouveau projet';
  data: any = null;

  statuses = [
    { value: 'PLANNED', label: 'Planifié' },
    { value: 'IN_PROGRESS', label: 'En cours' },
    { value: 'COMPLETED', label: 'Terminé' },
    { value: 'CANCELLED', label: 'Annulé' }
  ];

  constructor(
    private fb: FormBuilder,
    private dialogRef: MatDialogRef<ProjectFormComponent>
  ) {
    // Récupérer les données passées via dialogRef
    this.data = this.dialogRef?._containerInstance?._config?.data;
    this.isReadOnly = this.data?.isReadOnly || false;
    if (this.data?.project) {
      this.title = 'Modifier le projet';
    }
  }

  ngOnInit(): void {
    this.initForm();
    if (this.data?.project) {
      this.patchForm();
    }
    if (this.isReadOnly) {
      this.projectForm.disable();
    }
  }

  private initForm(): void {
    this.projectForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(3)]],
      description: ['', [Validators.required]],
      statuts: ['PLANNED', [Validators.required]],
      start_date: ['', [Validators.required]],
      end_date: ['', [Validators.required]],
      users: [[]]
    });
  }

  private patchForm(): void {
    const project = this.data?.project;
    if (!project) return;
    
    this.projectForm.patchValue({
      name: project.name || '',
      description: project.description || '',
      statuts: project.statuts || 'PLANNED',
      start_date: project.start_date ? new Date(project.start_date) : null,
      end_date: project.end_date ? new Date(project.end_date) : null,
      users: project.users?.map((u: any) => u.id) || []
    });
  }

  onSubmit(): void {
    if (this.projectForm.invalid) {
      this.projectForm.markAllAsTouched();
      return;
    }

    this.isLoading = true;
    const formValue = this.projectForm.value;
    
    if (formValue.start_date) {
      formValue.start_date = new Date(formValue.start_date).toISOString().split('T')[0];
    }
    if (formValue.end_date) {
      formValue.end_date = new Date(formValue.end_date).toISOString().split('T')[0];
    }

    this.dialogRef.close(formValue);
  }

  onCancel(): void {
    this.dialogRef.close(null);
  }

  get nameControl() { return this.projectForm.get('name'); }
  get descriptionControl() { return this.projectForm.get('description'); }
  get startDateControl() { return this.projectForm.get('start_date'); }
  get endDateControl() { return this.projectForm.get('end_date'); }
}