import { BadRequestException, Injectable } from '@nestjs/common';
import { GoogleLoginDto } from '../dto/google-login.dto';
import { FirebaseAdminService } from '../../security/firebase-admin.service';
import { FirebaseTokenService } from '../firebase/firebase-token.service';
import { FirebaseUserService } from '../firebase/firebase-user.service';
import { ProfileService } from '../profile.service';

export interface GoogleAuthResult {
  user: Awaited<ReturnType<ProfileService['get']>>;
}

@Injectable()
export class GoogleLoginUseCase {
  constructor(
    private readonly firebaseAdmin: FirebaseAdminService,
    private readonly firebase: FirebaseTokenService,
    private readonly users: FirebaseUserService,
    private readonly profile: ProfileService,
  ) {}

  async execute(dto: GoogleLoginDto): Promise<GoogleAuthResult> {
    if (!this.firebase.enabled) {
      throw new BadRequestException({
        code: 'AUTH_FIREBASE_DISABLED',
        message: 'Đăng nhập Google yêu cầu chế độ xác thực Firebase.',
      });
    }
    const token = await this.firebaseAdmin.verifyIdToken(dto.idToken);
    if (token.firebase?.sign_in_provider !== 'google.com') {
      throw new BadRequestException({
        code: 'AUTH_GOOGLE_REQUIRED',
        message: 'Vui lòng đăng nhập bằng tài khoản Google.',
      });
    }
    if (!token.email || !token.email_verified) {
      throw new BadRequestException({
        code: 'AUTH_EMAIL_NOT_VERIFIED',
        message: 'Tài khoản Google cần có email đã xác thực.',
      });
    }

    // The same verified UID always owns the same internal UUID. Never link by
    // email or issue a second token family alongside the Firebase SDK session.
    const principal = await this.users.resolve(token);
    return { user: await this.profile.get(principal.sub) };
  }
}
