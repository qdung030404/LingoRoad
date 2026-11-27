import { ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { Observable } from 'rxjs';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { FirebaseTokenService } from '../../modules/auth/firebase/firebase-token.service';
import { FirebaseUserService } from '../../modules/auth/firebase/firebase-user.service';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector, private readonly firebase: FirebaseTokenService, private readonly users: FirebaseUserService) {
    super();
  }

  canActivate(context: ExecutionContext): boolean | Promise<boolean> | Observable<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    return this.firebase.enabled ? this.firebaseAccess(context) : super.canActivate(context);
  }

  private async firebaseAccess(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const match = /^Bearer (\S+)$/i.exec(req.headers.authorization ?? '');
    if (!match || match[1].length > 4096) {
      throw new UnauthorizedException({ code: 'AUTH_UNAUTHORIZED', message: 'Yêu cầu Bearer token hợp lệ.' });
    }
    req.user = await this.users.resolve(await this.firebase.verify(match[1]));
    return true;
  }

  handleRequest<TUser = unknown>(err: unknown, user: TUser): TUser {
    if (err || !user) {
      throw err || new UnauthorizedException({ code: 'AUTH_UNAUTHORIZED', message: 'Yêu cầu Bearer token hợp lệ.' });
    }
    return user;
  }
}
