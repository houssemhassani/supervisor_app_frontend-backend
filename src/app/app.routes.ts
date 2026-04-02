// src/app/app.routes.ts
import { Routes } from '@angular/router';
import { LoginPage } from './pages/login/login-page/login-page';
import { ForgotPassword } from './pages/login/forgot-password/forgot-password';
import { ResetPasswordComponent } from './pages/login/reset-password/reset-password';
import { Users } from './pages/admin/users/users';
import { ProjectTask } from './pages/manager/project-task/project-task';
import { ProductivityDashboard } from './pages/manager/productivity-dashboard/productivity-dashboard';
import { AdminDashboard } from './pages/admin/dashboard/dashboard';
import { EmployeeDashboardComponent } from './pages/employee/dashboard/employee'; // Correction du chemin
import { ManagerDashboardComponent } from './pages/manager/manager-dashboard/manager-dashboard'; // NOUVEAU - Dashboard Manager
import { MainLayoutComponent } from './layouts/main-layout/main-layout';
import { AuthGuard } from './core/guards/auth-guard';
import { RoleGuard } from './core/guards/role-guard';

export const routes: Routes = [
  // Routes publiques (sans navbar)
  { path: '', redirectTo: 'login', pathMatch: 'full' },
  { path: 'login', component: LoginPage },
  { path: 'forgot-password', component: ForgotPassword },
  { path: 'reset-password', component: ResetPasswordComponent },
  
  // Routes protégées AVEC navbar (MainLayout)
  {
    path: '',
    component: MainLayoutComponent,
    canActivate: [AuthGuard],
    children: [
      // Routes Admin
      { path: 'admin/users', component: Users },
      { path: 'admin/dashboard', component: AdminDashboard },
      
      // Routes Manager
      { path: 'manager/project-task', component: ProjectTask },
      { path: 'manager/productivity-dashboard', component: ProductivityDashboard },
      { 
        path: 'manager/dashboard', 
        component: ManagerDashboardComponent,
        canActivate: [RoleGuard],
        data: { roles: ['MANAGER', 'ADMIN'] } // Accessible aux managers et admins
      },
      
      // Routes Employee
      { 
        path: 'employee/dashboard', 
        component: EmployeeDashboardComponent,
        canActivate: [RoleGuard],
        data: { roles: ['EMPLOYEE', 'MANAGER', 'ADMIN'] } // Accessible à tous
      },
      
      // Redirection par défaut selon le rôle (optionnel)
      // La redirection se fera dynamiquement dans le AuthGuard ou Login
      { path: 'dashboard', redirectTo: 'employee/dashboard', pathMatch: 'full' },
    ]
  },
  
  // Redirection pour toutes les autres routes
  { path: '**', redirectTo: 'login' }
];