import { Injectable } from '@angular/core';
import { CanActivate, ActivatedRouteSnapshot, Router } from '@angular/router';
import { AuthService } from '../services/AuthService/auth';

@Injectable({
  providedIn: 'root'
})
export class RoleGuard implements CanActivate {
  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  canActivate(route: ActivatedRouteSnapshot): boolean {
    const expectedRoles = route.data['roles'] as Array<string>;
    const userRole = this.authService.getUserRole();
    
    if (!userRole) {
      this.router.navigate(['/login']);
      return false;
    }
    
    if (expectedRoles && expectedRoles.includes(userRole)) {
      return true;
    }
    
    // Redirection selon le rôle
    switch (userRole) {
      case 'ADMIN':
        this.router.navigate(['/admin/dashboard']);
        break;
      case 'MANAGER':
        this.router.navigate(['/manager/project-task']);
        break;
      case 'EMPLOYEE':
        this.router.navigate(['/employee/dashboard']);
        break;
      default:
        this.router.navigate(['/login']);
    }
    
    return false;
  }
}