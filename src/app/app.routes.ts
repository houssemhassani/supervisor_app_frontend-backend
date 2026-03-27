// src/app/app.routes.ts
import { Routes } from '@angular/router';
import { LoginPage } from './pages/login/login-page/login-page';
import { ForgotPassword } from './pages/login/forgot-password/forgot-password';
import { ResetPasswordComponent } from './pages/login/reset-password/reset-password';
import { Users } from './pages/admin/users/users';
import { ProjectTask } from './pages/manager/project-task/project-task';
import { ProductivityDashboard } from './pages/manager/productivity-dashboard/productivity-dashboard';
import { AdminDashboard } from './pages/admin/dashboard/dashboard';
import { EmployeeDashboardComponent } from './pages/employee/dashboard/employee'; // NOUVEAU
import { MainLayoutComponent } from './layouts/main-layout/main-layout';
import { AuthGuard } from './core/guards/auth-guard';
import { RoleGuard } from './core/guards/role-guard'; // AJOUTER SI BESOIN

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
      
      // Routes Employee (NOUVEAU)
      { 
        path: 'employee/dashboard', 
        component: EmployeeDashboardComponent,
        // Si vous avez un RoleGuard pour restreindre l'accès
        // canActivate: [RoleGuard],
        // data: { roles: ['EMPLOYEE'] }
      },
      
      // Redirection par défaut après login (optionnel)
      { path: 'dashboard', redirectTo: 'employee/dashboard', pathMatch: 'full' }, // MODIFIÉ POUR EMPLOYEE
    ]
  },
  
  // Redirection pour toutes les autres routes
  { path: '**', redirectTo: 'login' }
];