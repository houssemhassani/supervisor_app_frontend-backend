// src/app/app.routes.ts
import { Routes } from '@angular/router';
import { LoginPage } from './pages/login/login-page/login-page';
import { ForgotPassword } from './pages/login/forgot-password/forgot-password';
import { ResetPasswordComponent } from './pages/login/reset-password/reset-password';
import { EmployeeDashboardComponent } from './pages/employee/dashboard/employee';
import { ManagerDashboardComponent } from './pages/manager/manager-dashboard/manager-dashboard';
import { AdminDashboard } from './pages/admin/dashboard/dashboard';
import { AuthGuard } from './core/guards/auth-guard';

export const routes: Routes = [
  // Routes publiques
  { path: '', redirectTo: 'login', pathMatch: 'full' },
  { path: 'login', component: LoginPage },
  { path: 'forgot-password', component: ForgotPassword },
  { path: 'reset-password', component: ResetPasswordComponent },
  
  // Routes protégées (simples, sans layout)
  { path: 'employee/dashboard', component: EmployeeDashboardComponent, canActivate: [AuthGuard] },
  { path: 'manager/dashboard', component: ManagerDashboardComponent, canActivate: [AuthGuard] },
  { path: 'admin/dashboard', component: AdminDashboard, canActivate: [AuthGuard] },
  
  // Redirection par défaut
  { path: '**', redirectTo: 'login' }
];