// src/app/components/shared/confirmation-dialog/confirmation-dialog.component.ts
import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';

export interface ConfirmationDialogData {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  type?: 'warning' | 'danger' | 'info' | 'success';
  confirmButtonColor?: string;
  icon?: string;
}

@Component({
  selector: 'app-confirmation-dialog',
  standalone: true,  // Important : indique que c'est un composant standalone
  imports: [
    CommonModule,    // Pour *ngIf, *ngFor, etc.
    MatIconModule,   // Pour mat-icon
    MatButtonModule  // Pour mat-button, mat-raised-button
  ],
  templateUrl: './confirmation-dialog.html',
  styleUrls: ['./confirmation-dialog.scss']
})
export class ConfirmationDialogComponent {
  
  constructor(
    public dialogRef: MatDialogRef<ConfirmationDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: ConfirmationDialogData
  ) {
    // Valeurs par défaut
    this.data.confirmText = this.data.confirmText || 'Confirmer';
    this.data.cancelText = this.data.cancelText || 'Annuler';
    this.data.type = this.data.type || 'info';
    
    // Icône par défaut selon le type
    if (!this.data.icon) {
      switch (this.data.type) {
        case 'warning':
          this.data.icon = 'warning';
          break;
        case 'danger':
          this.data.icon = 'error';
          break;
        case 'success':
          this.data.icon = 'check_circle';
          break;
        default:
          this.data.icon = 'info';
      }
    }
  }

  onConfirm(): void {
    this.dialogRef.close(true);
  }

  onCancel(): void {
    this.dialogRef.close(false);
  }

  getIconColor(): string {
    switch (this.data.type) {
      case 'warning': return '#ff9800';
      case 'danger': return '#f44336';
      case 'success': return '#4caf50';
      default: return '#2196f3';
    }
  }

  getButtonClass(): string {
    switch (this.data.type) {
      case 'danger': return 'btn-danger';
      case 'warning': return 'btn-warning';
      case 'success': return 'btn-success';
      default: return 'btn-primary';
    }
  }
}