import 'dotenv/config';
import { AuthProvider, CefrLevel, PrismaClient, UserRole, UserStatus } from '@prisma/client';
import * as argon2 from 'argon2';

export interface SeedAdminOptions {
  email: string;
  password: string;
  name: string;
}

export async function seedAdminAccount(
  prisma: PrismaClient,
  options: SeedAdminOptions,
): Promise<{ id: string; email: string; name: string }> {
  const email = options.email.trim().toLowerCase();
  const passwordHash = await argon2.hash(options.password, {
    type: argon2.argon2id,
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 4,
  });

  const admin = await prisma.user.upsert({
    where: { email },
    update: {
      name: options.name.trim(),
      passwordHash,
      role: UserRole.ADMIN,
      status: UserStatus.ACTIVE,
      provider: AuthProvider.LOCAL,
    },
    create: {
      email,
      name: options.name.trim(),
      passwordHash,
      role: UserRole.ADMIN,
      status: UserStatus.ACTIVE,
      provider: AuthProvider.LOCAL,
      profile: {
        create: {
          targetCefr: CefrLevel.C1,
          dailyGoalMinutes: 15,
          reminderEnabled: true,
        },
      },
    },
    select: {
      id: true,
      email: true,
      name: true,
    },
  });

  await prisma.userProfile.upsert({
    where: { userId: admin.id },
    update: {},
    create: {
      userId: admin.id,
      targetCefr: CefrLevel.C1,
      dailyGoalMinutes: 15,
      reminderEnabled: true,
    },
  });

  return admin;
}

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('Set DATABASE_URL to the target database.');
  }
  const databaseName = new URL(databaseUrl).pathname.slice(1);
  if (!/^(lingoroad(_(demo|test))?|postgres)$/.test(databaseName)) {
    throw new Error(
      'Seed CLI only accepts databases named lingoroad, lingoroad_demo, lingoroad_test or postgres.',
    );
  }

  const email = process.env.ADMIN_EMAIL ?? 'admin@lingoroad.local';
  const password = process.env.ADMIN_PASSWORD ?? 'Admin@123456';
  const name = process.env.ADMIN_NAME ?? 'Quản trị viên LingoRoad';

  const prisma = new PrismaClient();
  try {
    const admin = await seedAdminAccount(prisma, { email, password, name });
    console.log(
      `Seeded Admin account: ${admin.email} (${admin.name}) [id=${admin.id}]`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main().catch((error: unknown) => {
    console.error(
      error instanceof Error ? error.message : 'Admin seed failed.',
    );
    process.exitCode = 1;
  });
}
