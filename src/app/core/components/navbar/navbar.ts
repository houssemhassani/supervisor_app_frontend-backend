// src/app/core/components/navbar/navbar.component.ts

import { Component, OnInit, OnDestroy, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { AuthService, User } from '../../services/AuthService/auth';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './navbar.html',
  styleUrls: ['./navbar.scss']
})
export class NavbarComponent implements OnInit, OnDestroy {
  
  // Propriétés
  currentUser: User | null = null;
  showUserMenu: boolean = false;
  private userSubscription: Subscription;

  constructor(
    private authService: AuthService,
    private router: Router
  ) {
    // S'abonner aux changements de l'utilisateur courant
    this.userSubscription = this.authService.currentUser$.subscribe(user => {
      this.currentUser = user;
    });
  }

  ngOnInit(): void {}

  ngOnDestroy(): void {
    // Nettoyer l'abonnement pour éviter les fuites mémoire
    if (this.userSubscription) {
      this.userSubscription.unsubscribe();
    }
  }

  /**
   * Navigation vers le dashboard selon le rôle de l'utilisateur
   */
  navigateToDashboard(): void {
    const role = this.authService.getUserRole();
    
    switch (role) {
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
        this.router.navigate(['/dashboard']);
    }
  }

  /**
   * Afficher/Masquer le menu utilisateur
   */
  toggleUserMenu(): void {
    this.showUserMenu = !this.showUserMenu;
  }

  /**
   * Fermer le menu utilisateur
   */
  closeUserMenu(): void {
    this.showUserMenu = false;
  }

  /**
   * Déconnexion de l'utilisateur
   */
  logout(): void {
    this.closeUserMenu();
    this.authService.logout();
  }

  /**
   * Récupérer les initiales de l'utilisateur pour l'avatar
   */
  getUserInitials(): string {
    if (this.currentUser?.username) {
      return this.currentUser.username.charAt(0).toUpperCase();
    }
    return 'U';
  }

  /**
   * Récupérer le nom complet de l'utilisateur
   */
  getFullName(): string {
    return this.currentUser?.username || 'Utilisateur';
  }

  /**
   * Récupérer le rôle de l'utilisateur (version texte)
   */
  getUserRole(): string {
    const role = this.currentUser?.role?.name;
    if (role === 'admin') return 'Administrateur';
    if (role === 'manager') return 'Manager';
    if (role === 'employee') return 'Employé';
    return 'Utilisateur';
  }

  /**
   * Récupérer le rôle en anglais pour les conditions
   */
  getUserRoleCode(): string | null {
    return this.authService.getUserRole();
  }

  /**
   * Fermer le menu quand on clique en dehors
   */
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (!target.closest('.user-menu-container')) {
      this.closeUserMenu();
    }
  }
}