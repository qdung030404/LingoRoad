import { Injectable } from '@nestjs/common';
import { DecodedIdToken } from 'firebase-admin/auth';
import { FirebaseTokenService } from '../auth/firebase/firebase-token.service';

export type FirebaseDecodedToken = DecodedIdToken;

@Injectable()
export class FirebaseAdminService {
  // Compatibility adapter: every auth route shares project/ADC/emulator setup
  // and checks revocation through the established verifier.
  constructor(private readonly firebase: FirebaseTokenService) {}
  async verifyIdToken(idToken: string): Promise<FirebaseDecodedToken> {
    return this.firebase.verify(idToken);
  }
}
