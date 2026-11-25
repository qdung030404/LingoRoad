import { ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Observable } from 'rxjs';
import { FirebaseTokenService } from '../../auth/firebase/firebase-token.service';
import { FirebaseUserService } from '../../auth/firebase/firebase-user.service';

@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  constructor(
    private readonly firebase: FirebaseTokenService,
    private readonly users: FirebaseUserService,
  ) {
    super();
  }

  canActivate(context: ExecutionContext): boolean | Promise<boolean> | Observable<boolean> {
    const req = context
      .switchToHttp()
      .getRequest<{ headers?: { authorization?: string }; user?: unknown }>();
    const rawAuth = req.headers?.authorization?.trim();
    if (!rawAuth) {
      return true;
    }
    const match = /^Bearer (\S+)$/i.exec(rawAuth);
    if (!match || match[1].length > 4096) {
      throw new UnauthorizedException({
        code: 'AUTH_UNAUTHORIZED',
        message: 'Yêu cầu Bearer token hợp lệ.',
      });
    }
    if (this.firebase.enabled) {
      return this.firebase.verify(match[1]).then(async (decoded) => {
        req.user = await this.users.resolve(decoded);
        return true;
      });
    }
    return super.canActivate(context);
  }

  handleRequest<TUser = unknown>(err: unknown, user: TUser): TUser {
    if (err || !user) {
      throw (
        err ||
        new UnauthorizedException({
          code: 'AUTH_UNAUTHORIZED',
          message: 'Yêu cầu Bearer token hợp lệ.',
        })
      );
    }
    return user;
  }
}
