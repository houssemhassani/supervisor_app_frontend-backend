import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';

interface User {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  department?: string;
  position?: string;
  status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
  avatar?: string;
}

@Component({
  selector: 'app-users',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule],
  templateUrl: './users.html',
  styleUrls: ['./users.scss']
})
export class Users {
  users: User[] = [
    { id: 1, firstName: 'Alice', lastName: 'Johnson', email: 'alice@test.com', role: 'EMPLOYEE', status: 'ACTIVE', avatar: 'https://i.pravatar.cc/40?img=1' },
    { id: 2, firstName: 'Bob', lastName: 'Smith', email: 'bob@test.com', role: 'MANAGER', status: 'ACTIVE', avatar: 'https://i.pravatar.cc/40?img=2' },
    { id: 3, firstName: 'Charlie', lastName: 'Brown', email: 'charlie@test.com', role: 'ADMIN', status: 'ACTIVE', avatar: 'https://i.pravatar.cc/40?img=3' },
  ];

  roles: string[] = ['EMPLOYEE', 'MANAGER', 'ADMIN'];
  statuses: string[] = ['ACTIVE', 'INACTIVE', 'SUSPENDED'];

  showForm: boolean = false;
  editingUser: User = { id: 0, firstName: '', lastName: '', email: '', role: 'EMPLOYEE', status: 'ACTIVE', avatar: '' };

  showConfirmModal: boolean = false;
  confirmAction: 'delete' | 'toggle' = 'delete';
  selectedUser: User | null = null;

  openForm(user?: User) {
    this.editingUser = user ? { ...user } : { id: 0, firstName: '', lastName: '', email: '', role: 'EMPLOYEE', status: 'ACTIVE', avatar: '' };
    this.showForm = true;
  }

  closeForm() { this.showForm = false; }

  saveUser() {
    if (this.editingUser.id === 0) {
      this.users.push({ ...this.editingUser, id: Date.now() });
    } else {
      const idx = this.users.findIndex(u => u.id === this.editingUser.id);
      if (idx > -1) this.users[idx] = { ...this.editingUser };
    }
    this.closeForm();
  }

  openConfirm(user: User, action: 'delete' | 'toggle') {
    this.selectedUser = user;
    this.confirmAction = action;
    this.showConfirmModal = true;
  }

  cancelConfirm() {
    this.selectedUser = null;
    this.showConfirmModal = false;
  }

  confirm() {
    if (!this.selectedUser) return;

    if (this.confirmAction === 'delete') {
      this.users = this.users.filter(u => u.id !== this.selectedUser!.id);
    } else if (this.confirmAction === 'toggle') {
      this.selectedUser.status = this.selectedUser.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    }

    this.cancelConfirm();
  }

  getConfirmMessage() {
    if (!this.selectedUser) return '';
    if (this.confirmAction === 'delete') return `Are you sure you want to delete ${this.selectedUser.firstName} ${this.selectedUser.lastName}?`;
    if (this.confirmAction === 'toggle') {
      const action = this.selectedUser.status === 'ACTIVE' ? 'deactivate' : 'activate';
      return `Are you sure you want to ${action} ${this.selectedUser.firstName} ${this.selectedUser.lastName}?`;
    }
    return '';
  }

  getConfirmTitle() {
    return this.confirmAction === 'delete' ? 'Delete User' : 'Confirm Action';
  }
}