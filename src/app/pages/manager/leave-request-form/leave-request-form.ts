// src/app/components/manager/leave-request-form/leave-request-form.component.ts
import { Component, Inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, AbstractControl, ValidationErrors, ReactiveFormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ManagerService, LeaveRequest } from '../../../services/manager';

export interface LeaveRequestFormData {
  leaveRequest?: LeaveRequest;
  isReadOnly?: boolean;
}

@Component({
  selector: 'app-leave-request-form',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule
  ],
  templateUrl: './leave-request-form.html',
  styleUrls: ['./leave-request-form.scss']
})
export class LeaveRequestFormComponent implements OnInit {
  leaveForm: FormGroup;
  durationDays: number = 0;
  isSubmitting: boolean = false;
  minDate: Date = new Date();
  maxDate: Date = new Date(new Date().setFullYear(new Date().getFullYear() + 1));
  isLoading: boolean = false;
  currentUser: any = null;

  leaveTypes = [
    { value: 'ANNUAL', label: '🏖️ Congés annuels', description: 'Vacances et repos' },
    { value: 'SICK', label: '🤒 Congés maladie', description: 'Arrêt maladie' },
    { value: 'PERSONAL', label: '👤 Congés personnels', description: 'Affaires personnelles' },
    { value: 'UNPAID', label: '💰 Congés sans solde', description: 'Sans maintien de salaire' },
    { value: 'MATERNITY', label: '👶 Congés maternité', description: 'Naissance ou adoption' },
    { value: 'OTHER', label: '📝 Autre', description: 'Autre type de congé' }
  ];

  constructor(
    private fb: FormBuilder,
    private managerService: ManagerService,
    public dialogRef: MatDialogRef<LeaveRequestFormComponent>,
    @Inject(MAT_DIALOG_DATA) public data: LeaveRequestFormData  // ← Ajout de @Inject
  ) {
    this.leaveForm = this.fb.group({
      type: ['ANNUAL', [Validators.required]],
      start_date: ['', [Validators.required]],
      end_date: ['', [Validators.required]],
      reason: ['', [Validators.required, Validators.minLength(10), Validators.maxLength(500)]]
    }, { validators: this.dateRangeValidator.bind(this) });
  }

  ngOnInit(): void {
    this.loadCurrentUser();
    
    if (this.data?.leaveRequest) {
      this.loadLeaveRequestData();
    }

    if (this.data?.isReadOnly) {
      this.leaveForm.disable();
    }
  }

  loadCurrentUser(): void {
    const token = localStorage.getItem('token') || localStorage.getItem('jwt');
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        this.currentUser = payload;
      } catch(e) {
        console.error('Erreur décodage token:', e);
      }
    }
  }

  loadLeaveRequestData(): void {
    if (this.data.leaveRequest) {
      this.leaveForm.patchValue({
        type: this.data.leaveRequest.type,
        start_date: new Date(this.data.leaveRequest.start_date),
        end_date: new Date(this.data.leaveRequest.end_date),
        reason: this.data.leaveRequest.reason
      });
      this.calculateDuration();
    }
  }

  dateRangeValidator(group: AbstractControl): ValidationErrors | null {
    const start = group.get('start_date')?.value;
    const end = group.get('end_date')?.value;
    
    if (start && end) {
      const startDate = new Date(start);
      const endDate = new Date(end);
      
      if (startDate > endDate) {
        return { dateInvalid: 'La date de début doit être antérieure à la date de fin' };
      }
      
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      if (startDate < today) {
        return { pastDate: 'La date ne peut pas être dans le passé' };
      }
    }
    
    return null;
  }

  calculateDuration(): void {
    const start = this.leaveForm.get('start_date')?.value;
    const end = this.leaveForm.get('end_date')?.value;
    
    if (start && end) {
      const startDate = new Date(start);
      const endDate = new Date(end);
      const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
      this.durationDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    } else {
      this.durationDays = 0;
    }
  }

  onSubmit(): void {
    if (this.leaveForm.valid && !this.isSubmitting && !this.data?.isReadOnly) {
      this.isSubmitting = true;
      const formValue = this.leaveForm.value;
      
      const startDate = new Date(formValue.start_date);
      const endDate = new Date(formValue.end_date);
      
      const requestData = {
        type: formValue.type,
        start_date: startDate.toISOString().split('T')[0],
        end_date: endDate.toISOString().split('T')[0],
        reason: formValue.reason
      };
      
      if (this.data?.leaveRequest) {
        this.managerService.updateLeaveRequest(this.data.leaveRequest.id, requestData).subscribe({
          next: () => {
            this.dialogRef.close(requestData);
            this.isSubmitting = false;
          },
          error: (error) => {
            console.error('Erreur:', error);
            this.isSubmitting = false;
          }
        });
      } else {
        this.managerService.createLeaveRequest(requestData).subscribe({
          next: () => {
            this.dialogRef.close(requestData);
            this.isSubmitting = false;
          },
          error: (error) => {
            console.error('Erreur:', error);
            this.isSubmitting = false;
          }
        });
      }
    }
  }

  onCancel(): void {
    if (!this.isSubmitting) {
      this.dialogRef.close(null);
    }
  }

  getTypeDescription(typeValue: string): string {
    const type = this.leaveTypes.find(t => t.value === typeValue);
    return type ? type.description : '';
  }

  getErrorMessage(controlName: string): string {
    const control = this.leaveForm.get(controlName);
    
    if (control?.hasError('required')) {
      return 'Ce champ est requis';
    }
    
    if (control?.hasError('minlength')) {
      return `Minimum ${control.errors?.['minlength'].requiredLength} caractères`;
    }
    
    if (control?.hasError('maxlength')) {
      return `Maximum ${control.errors?.['maxlength'].requiredLength} caractères`;
    }
    
    return '';
  }

  getFormErrors(): string[] {
    const errors: string[] = [];
    
    if (this.leaveForm.hasError('dateInvalid')) {
      errors.push('La date de début doit être antérieure à la date de fin');
    }
    
    if (this.leaveForm.hasError('pastDate')) {
      errors.push('La date ne peut pas être dans le passé');
    }
    
    return errors;
  }
}