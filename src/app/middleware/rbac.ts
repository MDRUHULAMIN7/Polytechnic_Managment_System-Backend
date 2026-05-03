import type { NextFunction, Request, Response } from 'express';
import AppError from '../errors/AppError.js';
import httpStatus from 'http-status-codes';

// RBAC Roles
export enum UserRole {
  ADMIN = 'admin',
  INSTRUCTOR = 'instructor',
  STUDENT = 'student',
  SUPER_ADMIN = 'superAdmin',
}

/**
 * Requires user to have one of the specified roles
 * @param allowedRoles Array of roles that are allowed
 * @returns Middleware function
 */
export const requireRole = (...allowedRoles: UserRole[]) => {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      throw new AppError(
        httpStatus.UNAUTHORIZED,
        'Authentication required',
      );
    }

    if (!allowedRoles.includes(req.user.role)) {
      throw new AppError(
        httpStatus.FORBIDDEN,
        'You do not have permission to access this resource',
      );
    }

    next();
  };
};

/**
 * Checks if user has specific permission
 * @param requiredPermissions Array of permissions required
 * @param requireAll If true, user must have ALL permissions. If false, user needs ANY permission.
 * @returns Middleware function
 */
export const requirePermission = (
  requiredPermissions: string[],
  requireAll = true
) => {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      throw new AppError(
        httpStatus.UNAUTHORIZED,
        'Authentication required',
      );
    }

    const userPermissions = req.user.permissions || [];

    const hasPermission = requireAll
      ? requiredPermissions.every((perm) => userPermissions.includes(perm))
      : requiredPermissions.some((perm) => userPermissions.includes(perm));

    if (!hasPermission) {
      throw new AppError(
        httpStatus.FORBIDDEN,
        'Insufficient permissions',
      );
    }

    next();
  };
};

/**
 * Restricts user to only access their own resource
 * @param userIdParam The parameter name containing the user ID to verify
 * @returns Middleware function
 */
export const requireOwnership = (userIdParam = 'userId') => {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      throw new AppError(
        httpStatus.UNAUTHORIZED,
        'Authentication required',
      );
    }

    const targetUserId = req.params[userIdParam];

    // Allow admins to access any user's resource
    if (req.user.role === UserRole.ADMIN || req.user.role === UserRole.SUPER_ADMIN) {
      return next();
    }

    if (req.user.id !== targetUserId) {
      throw new AppError(
        httpStatus.FORBIDDEN,
        'You can only access your own resources',
      );
    }

    next();
  };
};

/**
 * Role-based permission mapping
 * Define what permissions each role has
 */
export const rolePermissions: Record<UserRole, string[]> = {
  [UserRole.SUPER_ADMIN]: [
    'manage_all',
    'manage_admins',
    'manage_instructors',
    'manage_students',
    'view_reports',
    'manage_settings',
  ],
  [UserRole.ADMIN]: [
    'manage_instructors',
    'manage_students',
    'manage_subjects',
    'manage_semesters',
    'view_reports',
    'create_notice',
    'update_notice',
    'delete_notice',
  ],
  [UserRole.INSTRUCTOR]: [
    'view_students',
    'manage_attendance',
    'upload_marks',
    'view_own_subjects',
    'view_own_assignments',
  ],
  [UserRole.STUDENT]: [
    'view_own_profile',
    'view_grades',
    'view_attendance',
    'submit_assignment',
    'view_notices',
  ],
};

/**
 * Middleware to attach user permissions based on role
 */
export const attachPermissions = (req: Request, res: Response, next: NextFunction) => {
  if (req.user) {
    const role = req.user.role as UserRole;
    req.user.permissions = rolePermissions[role] ?? [];
  }
  next();
};

/**
 * Helper function to check if a role has a specific permission
 */
export function roleHasPermission(role: UserRole, permission: string): boolean {
  return (rolePermissions[role] || []).includes(permission);
}
