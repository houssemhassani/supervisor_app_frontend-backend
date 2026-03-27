// src/app/models/user.model.ts

/**
 * Rôle utilisateur personnalisé
 */
export interface RoleUser {
  id: number;
  name: 'ADMIN' | 'MANAGER' | 'EMPLOYEE';
  description?: string;
}

/**
 * Modèle utilisateur principal
 */
export interface User {
  id: number;
  username: string;
  email: string;
  provider?: string;
  confirmed?: boolean;
  blocked?: boolean;
  createdAt?: Date | string;
  updatedAt?: Date | string;
  
  // Champs personnalisés
  department?: string;
  position?: string;
  is_manager?: boolean;
  statuts?: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
  
  // Relations
  role_user?: RoleUser;
  manager?: User;
  subordinates?: User[];
  avatar?: any; // Media
}

/**
 * Classe utilisateur avec méthodes utilitaires
 */
export class UserModel implements User {
  id: number;
  username: string;
  email: string;
  provider?: string;
  confirmed: boolean;
  blocked: boolean;
  createdAt?: Date;
  updatedAt?: Date;
  department?: string;
  position?: string;
  is_manager: boolean;
  statuts?: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
  role_user?: RoleUser;
  manager?: User;
  subordinates?: User[];
  avatar?: any;

  constructor(data: Partial<User> = {}) {
    this.id = data.id ?? 0;
    this.username = data.username ?? '';
    this.email = data.email ?? '';
    this.provider = data.provider;
    this.confirmed = data.confirmed ?? false;
    this.blocked = data.blocked ?? false;
    this.createdAt = data.createdAt ? new Date(data.createdAt) : undefined;
    this.updatedAt = data.updatedAt ? new Date(data.updatedAt) : undefined;
    this.department = data.department;
    this.position = data.position;
    this.is_manager = data.is_manager ?? false;
    this.statuts = data.statuts;
    this.role_user = data.role_user;
    this.manager = data.manager;
    this.subordinates = data.subordinates;
    this.avatar = data.avatar;
  }

  /**
   * Vérifier si l'utilisateur est un manager
   */
  isManager(): boolean {
    return this.is_manager === true || this.role_user?.name === 'MANAGER';
  }

  /**
   * Vérifier si l'utilisateur est admin
   */
  isAdmin(): boolean {
    return this.role_user?.name === 'ADMIN';
  }

  /**
   * Vérifier si l'utilisateur est employé
   */
  isEmployee(): boolean {
    return this.role_user?.name === 'EMPLOYEE';
  }

  /**
   * Vérifier si le compte est actif (non bloqué et confirmé)
   */
  isActive(): boolean {
    return this.statuts === 'ACTIVE' && !this.blocked && this.confirmed === true;
  }

  /**
   * Vérifier si le compte est bloqué
   */
  isBlocked(): boolean {
    return this.blocked === true;
  }

  /**
   * Vérifier si le compte est confirmé
   */
  isConfirmed(): boolean {
    return this.confirmed === true;
  }

  /**
   * Obtenir le nom complet (username par défaut)
   */
  getFullName(): string {
    return this.username;
  }

  /**
   * Obtenir le rôle en texte
   */
  getRoleLabel(): string {
    switch (this.role_user?.name) {
      case 'ADMIN':
        return 'Administrateur';
      case 'MANAGER':
        return 'Manager';
      case 'EMPLOYEE':
        return 'Employé';
      default:
        return 'Utilisateur';
    }
  }

  /**
   * Obtenir la couleur du rôle (pour les badges)
   */
  getRoleColor(): string {
    switch (this.role_user?.name) {
      case 'ADMIN':
        return 'danger';
      case 'MANAGER':
        return 'warning';
      case 'EMPLOYEE':
        return 'primary';
      default:
        return 'secondary';
    }
  }

  /**
   * Obtenir le statut en texte
   */
  getStatusLabel(): string {
    switch (this.statuts) {
      case 'ACTIVE':
        return 'Actif';
      case 'INACTIVE':
        return 'Inactif';
      case 'SUSPENDED':
        return 'Suspendu';
      default:
        return 'Inconnu';
    }
  }

  /**
   * Obtenir la couleur du statut
   */
  getStatusColor(): string {
    switch (this.statuts) {
      case 'ACTIVE':
        return 'success';
      case 'INACTIVE':
        return 'secondary';
      case 'SUSPENDED':
        return 'danger';
      default:
        return 'secondary';
    }
  }

  /**
   * Convertir en objet User
   */
  toUser(): User {
    return {
      id: this.id,
      username: this.username,
      email: this.email,
      provider: this.provider,
      confirmed: this.confirmed,
      blocked: this.blocked,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      department: this.department,
      position: this.position,
      is_manager: this.is_manager,
      statuts: this.statuts,
      role_user: this.role_user,
      manager: this.manager,
      subordinates: this.subordinates,
      avatar: this.avatar
    };
  }

  /**
   * Créer un UserModel à partir d'un User
   */
  static fromUser(user: User): UserModel {
    return new UserModel(user);
  }

  /**
   * Créer un UserModel vide
   */
  static empty(): UserModel {
    return new UserModel({
      id: 0,
      username: '',
      email: ''
    });
  }
}

/**
 * DTO pour la connexion
 */
export interface LoginRequest {
  identifier: string;
  password: string;
}

/**
 * DTO pour la réponse de connexion
 */
export interface LoginResponse {
  jwt: string;
  user: User;
}

/**
 * DTO pour l'inscription
 */
export interface RegisterRequest {
  username: string;
  email: string;
  password: string;
  department?: string;
  position?: string;
}

/**
 * DTO pour la mise à jour du profil
 */
export interface UpdateProfileRequest {
  username?: string;
  email?: string;
  department?: string;
  position?: string;
  avatar?: any;
}

/**
 * DTO pour le changement de mot de passe
 */
export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

/**
 * DTO pour la réinitialisation du mot de passe
 */
export interface ForgotPasswordRequest {
  email: string;
}

export interface ResetPasswordRequest {
  password: string;
  confirmPassword: string;
  code: string;
}

// ============================================
// MODÈLES POUR LE DASHBOARD
// ============================================

/**
 * Requête pour le check-in
 */
export interface CheckInRequest {
  location?: string;
  latitude?: number;
  longitude?: number;
}

/**
 * Requête pour la pause
 */
export interface BreakRequest {
  type?: 'LUNCH' | 'COFFEE' | 'SHORT' | 'OTHER';
}

/**
 * Requête pour les heures supplémentaires
 */
export interface OvertimeRequest {
  hours: number;
  reason: string;
  project_id?: number;
}

/**
 * Requête pour les congés
 */
export interface LeaveRequest {
  type: 'ANNUAL' | 'SICK' | 'PERSONAL' | 'UNPAID' | 'MATERNITY' | 'OTHER';
  start_date: string;
  end_date: string;
  reason?: string;
}

// ============================================
// MODÈLES POUR LE DASHBOARD - RÉPONSES
// ============================================

/**
 * Données du dashboard pour aujourd'hui
 */
export interface DashboardToday {
  date: string;
  attendance: {
    id?: number;
    checkIn?: Date;
    checkOut?: Date;
    status: string;
    isLate: boolean;
    lateMinutes: number;
    workHours: number;
    breakHours: number;
    expectedHours: number;
  };
  currentSession: {
    id: number;
    status: 'ACTIVE' | 'PAUSED' | 'FINISHED';
    startTime: Date;
    isOnBreak: boolean;
    breakInfo: {
      id: number;
      type: string;
      startTime: Date;
      duration: number;
    } | null;
  } | null;
  leaveBalance: {
    annual: { total: number; used: number; remaining: number };
    sick: { total: number; used: number; remaining: number };
    personal: { total: number; used: number; remaining: number };
  };
  overtimeMonth: {
    total: number;
    pending: number;
    remaining: number;
  };
  actions: {
    canCheckIn: boolean;
    canCheckOut: boolean;
    canStartBreak: boolean;
    canEndBreak: boolean;
    canRequestOvertime: boolean;
    canRequestLeave: boolean;
  };
}

/**
 * Statistiques de la semaine
 */
export interface WeeklyStats {
  week: {
    start: string;
    end: string;
  };
  totalWorkHours: number;
  totalBreakHours: number;
  daysPresent: number;
  daysLate: number;
  averageDailyHours: number;
  expectedHours: number;
  remainingHours: number;
}

// ============================================
// MODÈLES POUR L'ATTENDANCE
// ============================================

/**
 * Modèle Attendance
 */
export interface Attendance {
  id: number;
  users_permissions_user: User;
  date: Date;
  check_in?: Date;
  check_out?: Date;
  statuts: 'PRESENT' | 'ABSENT' | 'LATE' | 'HALF_DAY' | 'HOLIDAY';
  check_in_late_minutes: number;
  early_checkout_minutes: number;
  work_hours: number;
  location?: any;
  ip_address?: string;
  notes?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

/**
 * Classe Attendance avec méthodes utilitaires
 */
export class AttendanceModel implements Attendance {
  id: number;
  users_permissions_user: User;
  date: Date;
  check_in?: Date;
  check_out?: Date;
  statuts: 'PRESENT' | 'ABSENT' | 'LATE' | 'HALF_DAY' | 'HOLIDAY' = 'PRESENT';
  check_in_late_minutes: number = 0;
  early_checkout_minutes: number = 0;
  work_hours: number = 0;
  location?: any;
  ip_address?: string;
  notes?: string;
  createdAt?: Date;
  updatedAt?: Date;

  constructor(data: Partial<Attendance> = {}) {
    this.id = data.id ?? 0;
    this.users_permissions_user = data.users_permissions_user!;
    this.date = data.date ?? new Date();
    this.check_in = data.check_in;
    this.check_out = data.check_out;
    this.statuts = data.statuts ?? 'PRESENT';
    this.check_in_late_minutes = data.check_in_late_minutes ?? 0;
    this.early_checkout_minutes = data.early_checkout_minutes ?? 0;
    this.work_hours = data.work_hours ?? 0;
    this.location = data.location;
    this.ip_address = data.ip_address;
    this.notes = data.notes;
    this.createdAt = data.createdAt;
    this.updatedAt = data.updatedAt;
  }

  get isPresent(): boolean {
    return this.statuts === 'PRESENT' && this.check_in !== undefined;
  }

  get isLate(): boolean {
    return this.check_in_late_minutes > 0;
  }

  get formattedWorkHours(): string {
    const hours = Math.floor(this.work_hours);
    const minutes = Math.floor((this.work_hours - hours) * 60);
    return `${hours}h${minutes > 0 ? minutes + 'min' : ''}`;
  }
}

// ============================================
// MODÈLES POUR LES PAUSES
// ============================================

/**
 * Modèle Break
 */
export interface Break {
  id: number;
  users_permissions_user: User;
  time_log?: any;
  start_time: Date;
  end_time?: Date;
  duration_minutes?: number;
  type: 'LUNCH' | 'COFFEE' | 'SHORT' | 'OTHER';
  statuts: 'ACTIVE' | 'ENDED';
  createdAt?: Date;
  updatedAt?: Date;
}

/**
 * Classe Break avec méthodes utilitaires
 */
export class BreakModel implements Break {
  id: number;
  users_permissions_user: User;
  time_log?: any;
  start_time: Date;
  end_time?: Date;
  duration_minutes?: number;
  type: 'LUNCH' | 'COFFEE' | 'SHORT' | 'OTHER' = 'SHORT';
  statuts: 'ACTIVE' | 'ENDED' = 'ACTIVE';
  createdAt?: Date;
  updatedAt?: Date;

  constructor(data: Partial<Break> = {}) {
    this.id = data.id ?? 0;
    this.users_permissions_user = data.users_permissions_user!;
    this.time_log = data.time_log;
    this.start_time = data.start_time ?? new Date();
    this.end_time = data.end_time;
    this.duration_minutes = data.duration_minutes;
    this.type = data.type ?? 'SHORT';
    this.statuts = data.statuts ?? 'ACTIVE';
    this.createdAt = data.createdAt;
    this.updatedAt = data.updatedAt;
  }

  get isActive(): boolean {
    return this.statuts === 'ACTIVE';
  }

  get formattedDuration(): string {
    if (!this.duration_minutes) return 'En cours...';
    const hours = Math.floor(this.duration_minutes / 60);
    const minutes = this.duration_minutes % 60;
    return hours > 0 ? `${hours}h${minutes > 0 ? minutes + 'min' : ''}` : `${minutes}min`;
  }

  get typeLabel(): string {
    switch (this.type) {
      case 'LUNCH':
        return 'Déjeuner';
      case 'COFFEE':
        return 'Café';
      case 'SHORT':
        return 'Pause courte';
      case 'OTHER':
        return 'Autre';
      default:
        return 'Pause';
    }
  }
}

// ============================================
// MODÈLES POUR LE TIME LOG
// ============================================

/**
 * Modèle TimeLog
 */
export interface TimeLog {
  id: number;
  user: User;
  project?: any;
  start_time: Date;
  end_time?: Date;
  statuts: 'ACTIVE' | 'PAUSED' | 'FINISHED';
  breaks?: Break[];
  total_break_minutes?: number;
  net_work_minutes?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

/**
 * Classe TimeLog avec méthodes utilitaires
 */
export class TimeLogModel implements TimeLog {
  id: number;
  user: User;
  project?: any;
  start_time: Date;
  end_time?: Date;
  statuts: 'ACTIVE' | 'PAUSED' | 'FINISHED' = 'ACTIVE';
  breaks?: Break[];
  total_break_minutes?: number;
  net_work_minutes?: number;
  createdAt?: Date;
  updatedAt?: Date;

  constructor(data: Partial<TimeLog> = {}) {
    this.id = data.id ?? 0;
    this.user = data.user!;
    this.project = data.project;
    this.start_time = data.start_time ?? new Date();
    this.end_time = data.end_time;
    this.statuts = data.statuts ?? 'ACTIVE';
    this.breaks = data.breaks;
    this.total_break_minutes = data.total_break_minutes;
    this.net_work_minutes = data.net_work_minutes;
    this.createdAt = data.createdAt;
    this.updatedAt = data.updatedAt;
  }

  get isActive(): boolean {
    return this.statuts === 'ACTIVE';
  }

  get isPaused(): boolean {
    return this.statuts === 'PAUSED';
  }

  get isFinished(): boolean {
    return this.statuts === 'FINISHED';
  }

  get duration(): number {
    const end = this.end_time || new Date();
    const durationMs = end.getTime() - new Date(this.start_time).getTime();
    return durationMs / (1000 * 60 * 60); // Heures
  }

  get netDuration(): number {
    if (this.net_work_minutes) {
      return this.net_work_minutes / 60;
    }
    return this.duration;
  }

  get formattedDuration(): string {
    const hours = Math.floor(this.duration);
    const minutes = Math.floor((this.duration - hours) * 60);
    return `${hours}h${minutes > 0 ? minutes + 'min' : ''}`;
  }
}

// ============================================
// EXPORT POUR LA COMPATIBILITÉ
// ============================================

// Ré-export pour assurer la compatibilité avec les anciens imports
export type { BreakRequest as BreakRequestType };
export type { CheckInRequest as CheckInRequestType };
export type { OvertimeRequest as OvertimeRequestType };
export type { LeaveRequest as LeaveRequestType };
export type { DashboardToday as DashboardTodayType };
export type { WeeklyStats as WeeklyStatsType };