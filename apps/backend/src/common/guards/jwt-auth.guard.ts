import { ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { FirebaseTokenService } from '../../modules/auth/firebase/firebase-token.service';
import { FirebaseUserService } from '../../modules/auth/firebase/firebase-user.service';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector, private readonly firebase: FirebaseTokenService, private readonly users: FirebaseUserService) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    return this.firebase.enabled ? this.firebaseAccess(context) : super.canActivate(context);
  }

  private async firebaseAccess(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest();
    const match = /^Bearer (\S+)$/i.exec(req.headers.authorization ?? '');
    if (!match) throw new UnauthorizedException('AUTH_UNAUTHORIZED');
    req.user = await this.users.resolve(await this.firebase.verify(match[1]));
    return true;
  }

  handleRequest<TUser = unknown>(err: unknown, user: TUser, info: unknown): TUser {
    if (err || !user) {
      throw err || new UnauthorizedException('AUTH_UNAUTHORIZED');
    }
    return user;
  }
}
