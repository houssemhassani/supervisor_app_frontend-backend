import { Routes } from '@angular/router';
import { LoginPage } from './pages/login/login-page/login-page';
import { ForgotPassword } from './pages/login/forgot-password/forgot-password';

export const routes: Routes = [
  { path: '', redirectTo: 'login', pathMatch: 'full' }, // redirige vers login par défaut
  { path: 'login', component: LoginPage },
  { path: 'forgot-password', component: ForgotPassword },
  { path: '**', redirectTo: 'login' } // toute autre route redirige vers login
];