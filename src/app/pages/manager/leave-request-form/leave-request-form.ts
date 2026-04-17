import { Component, Inject, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { FormBuilder, FormGroup, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { CommonModule } from '@angular/common';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ReactiveFormsModule } from '@angular/forms';
import { MatDividerModule } from '@angular/material/divider';
import { MatTooltipModule } from '@angular/material/tooltip';

import { ManagerService, LeaveRequest } from '../../../services/manager';

// ============================================
// INTERFACES
// ============================================

interface DialogData {
  leaveRequest?: LeaveRequest;
  isReadOnly?: boolean;
  mode?: 'create' | 'edit' | 'view';
}

interface LeaveType {
  value: string;
  label: string;
  icon: string;
  description: string;
  color: string;
}

// ============================================
// VALIDATEURS PERSONNALISÉS
// ============================================

function dateRangeValidator(group: AbstractControl): ValidationErrors | null {
  const start = group.get('start_date')?.value;
  const end = group.get('end_date')?.value;
  
  if (!start || !end) return null;
  
  const startDate = new Date(start);
  const endDate = new Date(end);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  if (startDate < today) {
    return { startDateInPast: true };
  }
  
  if (endDate < startDate) {
    return { endBeforeStart: true };
  }
  
  const maxDuration = 365;
  const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
  
  if (diffDays > maxDuration) {
    return { maxDurationExceeded: true };
  }
  
  return null;
}

function reasonValidator(control: AbstractControl): ValidationErrors | null {
  const value = control.value;
  if (!value) return null;
  
  if (value.length < 10) {
    return { minlength: { requiredLength: 10, actualLength: value.length } };
  }
  
  if (value.length > 500) {
    return { maxlength: { requiredLength: 500, actualLength: value.length } };
  }
  
  return null;
}

// ============================================
// COMPOSANT PRINCIPAL
// ============================================

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
    MatProgressSpinnerModule,
    MatDividerModule,
    MatTooltipModule
  ],
  templateUrl: './leave-request-form.html',
  styleUrls: ['./leave-request-form.scss']
})
export class LeaveRequestFormComponent implements OnInit, OnDestroy {
  
  // ============================================
  // PROPRIÉTÉS
  // ============================================
  
  leaveForm!: FormGroup;
  isReadOnly: boolean = false;
  mode: 'create' | 'edit' | 'view' = 'create';
  isLoading: boolean = false;
  originalRequest: LeaveRequest | null = null;
  
  leaveTypes: LeaveType[] = [
    { value: 'ANNUAL', label: 'Congés annuels', icon: 'beach_access', description: 'Congés payés annuels', color: '#3b82f6' },
    { value: 'SICK', label: 'Congés maladie', icon: 'sick', description: 'Arrêt maladie justifié', color: '#f59e0b' },
    { value: 'PERSONAL', label: 'Congés personnels', icon: 'person', description: 'Raisons personnelles', color: '#10b981' },
    { value: 'UNPAID', label: 'Congés sans solde', icon: 'money_off', description: 'Congé non rémunéré', color: '#6b7280' },
    { value: 'MATERNITY', label: 'Congés maternité', icon: 'family_restroom', description: 'Congé maternité/paternité', color: '#06b6d4' },
    { value: 'OTHER', label: 'Autres congés', icon: 'more_horiz', description: 'Autres types de congés', color: '#8b5cf6' }
  ];
  
  holidays: string[] = [
    '2026-01-01', '2026-04-06', '2026-05-01', '2026-05-08',
    '2026-05-14', '2026-05-25', '2026-07-14', '2026-08-15',
    '2026-11-01', '2026-11-11', '2026-12-25'
  ];
  
  private subscriptions: any[] = [];
  
  // ============================================
  // CONSTRUCTEUR
  // ============================================
  
  constructor(
    private fb: FormBuilder,
    private dialogRef: MatDialogRef<LeaveRequestFormComponent>,
    private snackBar: MatSnackBar,
    private cdr: ChangeDetectorRef,
    @Inject(MAT_DIALOG_DATA) public data: DialogData
  ) {
    this.isReadOnly = data?.isReadOnly || false;
    this.mode = data?.mode || (data?.leaveRequest ? 'edit' : 'create');
    this.originalRequest = data?.leaveRequest || null;
    
    if (this.mode === 'view') {
      this.isReadOnly = true;
    }
  }
  
  // ============================================
  // CYCLE DE VIE
  // ============================================
  
  ngOnInit(): void {
    this.initForm();
    
    if (this.mode !== 'create' && this.originalRequest) {
      this.populateForm();
    }
    
    if (!this.isReadOnly) {
      this.setupDateListeners();
    }
  }
  
  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub?.unsubscribe());
  }
  
  // ============================================
  // INITIALISATION
  // ============================================
  
  private initForm(): void {
    this.leaveForm = this.fb.group({
      type: ['', [Validators.required]],
      start_date: ['', [Validators.required]],
      end_date: ['', [Validators.required]],
      reason: ['', [Validators.required, reasonValidator]]
    }, { validators: [dateRangeValidator] });
  }
  
  private setupDateListeners(): void {
    const startSub = this.leaveForm.get('start_date')?.valueChanges.subscribe(() => {
      this.updateDuration();
    });
    
    const endSub = this.leaveForm.get('end_date')?.valueChanges.subscribe(() => {
      this.updateDuration();
    });
    
    if (startSub) this.subscriptions.push(startSub);
    if (endSub) this.subscriptions.push(endSub);
  }
  
  private populateForm(): void {
    if (!this.originalRequest) return;
    
    this.leaveForm.patchValue({
      type: this.originalRequest.type,
      start_date: new Date(this.originalRequest.start_date),
      end_date: new Date(this.originalRequest.end_date),
      reason: this.originalRequest.reason
    });
    
    this.updateDuration();
  }
  
  // ============================================
  // MÉTHODES PUBLIQUES
  // ============================================
  
  onSubmit(): void {
    if (this.isReadOnly) {
      this.close();
      return;
    }
    
    if (this.leaveForm.invalid) {
      this.markAllFieldsAsTouched();
      this.showValidationErrors();
      return;
    }
    
    this.isLoading = true;
    
    const formValue = this.leaveForm.value;
    const startDate = new Date(formValue.start_date);
    const endDate = new Date(formValue.end_date);
    const durationDays = this.calculateDuration(startDate, endDate);
    
    const result = {
      type: formValue.type,
      start_date: this.formatDate(startDate),
      end_date: this.formatDate(endDate),
      reason: formValue.reason,
      duration_days: durationDays
    };
    
    setTimeout(() => {
      this.isLoading = false;
      this.dialogRef.close(result);
    }, 500);
  }
  
  close(): void {
    this.dialogRef.close();
  }
  
  getTitle(): string {
    if (this.mode === 'view') return 'Détail de la demande';
    if (this.mode === 'edit') return 'Modifier la demande';
    return 'Nouvelle demande de congé';
  }
  
  getSelectedTypeIcon(): string {
    const selectedType = this.leaveForm.get('type')?.value;
    return this.leaveTypes.find(t => t.value === selectedType)?.icon || 'event';
  }
  
  getSelectedTypeColor(): string {
    const selectedType = this.leaveForm.get('type')?.value;
    return this.leaveTypes.find(t => t.value === selectedType)?.color || '#3b82f6';
  }
  
  getDuration(): number | null {
    const start = this.leaveForm.get('start_date')?.value;
    const end = this.leaveForm.get('end_date')?.value;
    if (!start || !end) return null;
    return this.calculateDuration(new Date(start), new Date(end));
  }
  
  hasHolidayInPeriod(): boolean {
    const start = this.leaveForm.get('start_date')?.value;
    const end = this.leaveForm.get('end_date')?.value;
    if (!start || !end) return false;
    
    const startDate = new Date(start);
    const endDate = new Date(end);
    const currentDate = new Date(startDate);
    
    while (currentDate <= endDate) {
      if (this.holidays.includes(this.formatDate(currentDate))) return true;
      currentDate.setDate(currentDate.getDate() + 1);
    }
    return false;
  }
  
  hasWeekendInPeriod(): boolean {
    const start = this.leaveForm.get('start_date')?.value;
    const end = this.leaveForm.get('end_date')?.value;
    if (!start || !end) return false;
    
    const startDate = new Date(start);
    const endDate = new Date(end);
    const currentDate = new Date(startDate);
    
    while (currentDate <= endDate) {
      const day = currentDate.getDay();
      if (day === 0 || day === 6) return true;
      currentDate.setDate(currentDate.getDate() + 1);
    }
    return false;
  }
  
  getWorkingDaysCount(): number {
    const start = this.leaveForm.get('start_date')?.value;
    const end = this.leaveForm.get('end_date')?.value;
    if (!start || !end) return 0;
    
    const startDate = new Date(start);
    const endDate = new Date(end);
    const currentDate = new Date(startDate);
    let workingDays = 0;
    
    while (currentDate <= endDate) {
      const day = currentDate.getDay();
      if (day !== 0 && day !== 6) workingDays++;
      currentDate.setDate(currentDate.getDate() + 1);
    }
    return workingDays;
  }
  
  formatDateForDisplay(date: Date | string): string {
    const d = new Date(date);
    return d.toLocaleDateString('fr-FR', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });
  }
  
  // ============================================
  // MÉTHODES PRIVÉES
  // ============================================
  
  private updateDuration(): void {
    this.cdr.detectChanges();
  }
  
  private calculateDuration(start: Date, end: Date): number {
    const diffTime = Math.abs(end.getTime() - start.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
  }
  
  private formatDate(date: Date): string {
    return date.toISOString().split('T')[0];
  }
  
  private markAllFieldsAsTouched(): void {
    Object.keys(this.leaveForm.controls).forEach(key => {
      this.leaveForm.get(key)?.markAsTouched();
    });
  }
  
  private showValidationErrors(): void {
    const errors: string[] = [];
    
    if (this.leaveForm.hasError('startDateInPast')) errors.push('La date de début ne peut pas être dans le passé');
    if (this.leaveForm.hasError('endBeforeStart')) errors.push('La date de fin doit être postérieure à la date de début');
    if (this.leaveForm.hasError('maxDurationExceeded')) errors.push('La durée maximale est de 365 jours');
    if (this.leaveForm.get('type')?.hasError('required')) errors.push('Le type de congé est requis');
    if (this.leaveForm.get('reason')?.hasError('required')) errors.push('La raison est requise');
    if (this.leaveForm.get('reason')?.hasError('minlength')) errors.push('La raison doit contenir au moins 10 caractères');
    if (this.leaveForm.get('reason')?.hasError('maxlength')) errors.push('La raison ne peut pas dépasser 500 caractères');
    
    if (errors.length) {
      this.snackBar.open(errors.join(', '), 'Fermer', { duration: 5000, panelClass: 'snackbar-error' });
    }
  }
}