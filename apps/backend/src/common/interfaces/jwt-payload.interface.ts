import { UserRole } from '@prisma/client';

export interface JwtPayload {
  sub: string;
  email: string;
  role: UserRole;
  firebaseUid?: string;
  iat?: number;
  exp?: number;
}
