import { Routes } from '@angular/router';
import { LoginPage } from './pages/login/login-page/login-page';
import { ForgotPassword } from './pages/login/forgot-password/forgot-password';
import { Users } from './pages/admin/users/users';
import      {ProjectTask } from './pages/manager/project-task/project-task'
import { ProductivityDashboard } from './pages/manager/productivity-dashboard/productivity-dashboard';
import { AdminDashboard } from './pages/admin/dashboard/dashboard';

export const routes: Routes = [
  { path: '', redirectTo: 'login', pathMatch: 'full' }, // redirige vers login par défaut
  { path: 'login', component: LoginPage },
  { path: 'admin/users', component: Users },
  { path: 'admin/dashboard', component: AdminDashboard },
  { path: 'manager/project-task', component: ProjectTask },
    { path: 'manager/productivity-dashboard', component: ProductivityDashboard },

  { path: 'forgot-password', component: ForgotPassword },
  { path: '**', redirectTo: 'login' } // toute autre route redirige vers login
];