import { ExecutionContext, ForbiddenException, UnauthorizedException, ValidationPipe } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { ThrottlerGuard } from '@nestjs/throttler';
import { UserRole, UserStatus } from '@prisma/client';
import { AdminJwtGuard } from '../admin/guards/admin-jwt.guard';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { FirebaseTokenService } from '../auth/firebase/firebase-token.service';
import { FirebaseUserService } from '../auth/firebase/firebase-user.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateGrammarTopicDto } from './dto/grammar-admin.dto';
import { GrammarTreeQueryDto } from './dto/grammar-query.dto';
import { GrammarAdminController } from './grammar-admin.controller';
import { GrammarController } from './grammar.controller';
import { OptionalJwtAuthGuard } from './guards/optional-jwt-auth.guard';
import { GrammarCatalogService } from './services/grammar-catalog.service';
import { GrammarDagService } from './services/grammar-dag.service';

describe('GrammarController, GrammarAdminController & Guards', () => {
  let controller: GrammarController;
  let adminController: GrammarAdminController;

  const catalogMock = {
    getLevelsOverview: jest.fn().mockImplementation(async (userId?: string) => ({
      levels: [
        {
          cefrLevel: 'A1',
          topicCount: 9,
          lessonCount: 1,
          sampleGroups: ['Hệ thống 12 Thì'],
          ...(userId ? { completedCount: 1 } : {}),
        },
      ],
    })),
    getGrammarTree: jest.fn().mockResolvedValue({ groupBy: 'hierarchy', tree: [] }),
    listTopics: jest.fn().mockResolvedValue({
      items: [],
      meta: { total: 0, page: 1, limit: 20, totalPages: 1 },
    }),
    getTopicDetail: jest.fn().mockResolvedValue({
      id: '00000000-0000-4000-8000-000000000003',
      code: 'grammar.tenses.present_simple',
      cefrLevel: 'A1',
      isLeaf: true,
    }),
    getTopicPracticeItems: jest.fn().mockResolvedValue({
      topicCode: 'grammar.tenses.present_simple',
      cefrLevel: 'A1',
      items: [],
      meta: { total: 0, limit: 10, offset: 0 },
    }),
  };

  const dagMock = {
    listAdminTopics: jest.fn().mockResolvedValue([
      {
        id: '00000000-0000-4000-8000-000000000010',
        code: 'grammar.custom_group',
        published: false,
      },
    ]),
    createTopic: jest.fn().mockImplementation(async (dto: CreateGrammarTopicDto) => ({
      id: '00000000-0000-4000-8000-000000000010',
      ...dto,
    })),
    updateTopic: jest.fn().mockResolvedValue({ id: '00000000-0000-4000-8000-000000000010' }),
    deleteTopic: jest.fn().mockResolvedValue({ deleted: true, id: '00000000-0000-4000-8000-000000000010' }),
    addPrerequisite: jest.fn().mockImplementation(async (dto) => dto),
    removePrerequisite: jest.fn().mockResolvedValue({ deleted: true }),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [GrammarController, GrammarAdminController],
      providers: [
        { provide: GrammarCatalogService, useValue: catalogMock },
        { provide: GrammarDagService, useValue: dagMock },
      ],
    })
      .overrideGuard(ThrottlerGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(OptionalJwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(AdminJwtGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = moduleRef.get(GrammarController);
    adminController = moduleRef.get(GrammarAdminController);
  });

  it('serves levels, tree, topics, detail, and practice items with standard envelope', async () => {
    const guestLevels = await controller.getLevels(null);
    expect(guestLevels.success).toBe(true);
    expect(guestLevels.data.levels[0].completedCount).toBeUndefined();

    const learnerLevels = await controller.getLevels('learner-uuid');
    expect(learnerLevels.data.levels[0].completedCount).toBe(1);

    const treeRes = await controller.getTree({ groupBy: 'hierarchy', cefrLevel: 'C2' }, 'learner-uuid');
    expect(treeRes.success).toBe(true);
    expect(catalogMock.getGrammarTree).toHaveBeenCalledWith(
      { groupBy: 'hierarchy', cefrLevel: 'C2' },
      'learner-uuid',
    );

    const listRes = await controller.listTopics({ page: 1, limit: 20, cefrLevel: 'B1' }, null);
    expect(listRes.meta.limit).toBe(20);

    const detailRes = await controller.getTopicDetail('grammar.tenses.present_simple', null);
    expect(detailRes.data.code).toBe('grammar.tenses.present_simple');

    const practiceRes = await controller.getPracticeItems('grammar.tenses.present_simple', {
      limit: 10,
      offset: 0,
    });
    expect(practiceRes.data.topicCode).toBe('grammar.tenses.present_simple');

    const adminList = await adminController.listTopics(undefined, undefined, 'false', undefined);
    expect(adminList.success).toBe(true);
    expect(adminList.data).toHaveLength(1);
    expect(dagMock.listAdminTopics).toHaveBeenCalledWith({
      cefrLevel: undefined,
      search: undefined,
      published: 'false',
      isLeaf: undefined,
    });
  });

  it('validates query and admin DTOs strictly via ValidationPipe', async () => {
    const pipe = new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      transformOptions: { enableImplicitConversion: true },
    });

    await expect(
      pipe.transform({ cefrLevel: 'INVALID' }, { type: 'query', metatype: GrammarTreeQueryDto }),
    ).rejects.toThrow();

    await expect(
      pipe.transform(
        { code: 'invalid_prefix', cefrLevel: 'A1', isLeaf: false, titleEn: 'X', titleVi: 'Y' },
        { type: 'body', metatype: CreateGrammarTopicDto },
      ),
    ).rejects.toThrow();

    const validCreate = await pipe.transform(
      { code: 'grammar.custom_group', cefrLevel: 'B1', isLeaf: false, titleEn: 'Group', titleVi: 'Nhóm' },
      { type: 'body', metatype: CreateGrammarTopicDto },
    );
    const created = await adminController.createTopic(validCreate);
    expect(created.success).toBe(true);
    expect(created.data.code).toBe('grammar.custom_group');
  });

  it('enforces OptionalJwtAuthGuard for anonymous vs malformed vs valid Firebase tokens and AdminJwtGuard for ADMIN', async () => {
    const firebaseToken = {
      enabled: true,
      verify: jest.fn().mockResolvedValue({ uid: 'fb-1' }),
    } as unknown as FirebaseTokenService;
    const firebaseUsers = {
      resolve: jest.fn().mockResolvedValue({ sub: 'user-1', role: 'LEARNER' }),
    } as unknown as FirebaseUserService;

    const optionalGuard = new OptionalJwtAuthGuard(firebaseToken, firebaseUsers);
    const makeCtx = (authorization?: string) => {
      const req: { headers: { authorization?: string }; user?: { sub: string; role?: string } } = {
        headers: { ...(authorization ? { authorization } : {}) },
      };
      return {
        req,
        ctx: {
          getHandler: () => GrammarAdminController.prototype.createTopic,
          getClass: () => GrammarAdminController,
          switchToHttp: () => ({ getRequest: () => req }),
        } as unknown as ExecutionContext,
      };
    };

    // Anonymous guest -> allowed with no user
    const guest = makeCtx();
    expect(optionalGuard.canActivate(guest.ctx)).toBe(true);
    expect(guest.req.user).toBeUndefined();

    // Malformed header -> 401
    expect(() => optionalGuard.canActivate(makeCtx('Basic abc').ctx)).toThrow(UnauthorizedException);

    // Valid Bearer token -> resolves user
    const auth = makeCtx('Bearer valid-jwt');
    await expect(optionalGuard.canActivate(auth.ctx)).resolves.toBe(true);
    expect(auth.req.user).toEqual({ sub: 'user-1', role: 'LEARNER' });

    // AdminJwtGuard blocks LEARNER and allows ADMIN with internal Admin JWT
    const jwtMock = {
      verifyAsync: jest.fn().mockResolvedValue({ sub: 'u-1', email: 'u@test.local', role: UserRole.ADMIN }),
    } as unknown as JwtService;
    const prismaMock = {
      user: {
        findUnique: jest
          .fn()
          .mockResolvedValueOnce({
            id: 'u-1',
            email: 'learner@test.local',
            role: UserRole.LEARNER,
            status: UserStatus.ACTIVE,
            firebaseUid: null,
          })
          .mockResolvedValueOnce({
            id: 'u-1',
            email: 'admin@test.local',
            role: UserRole.ADMIN,
            status: UserStatus.ACTIVE,
            firebaseUid: null,
          }),
      },
    } as unknown as PrismaService;
    const adminGuard = new AdminJwtGuard(
      new Reflector(),
      jwtMock,
      prismaMock,
      firebaseToken,
      firebaseUsers,
    );
    await expect(adminGuard.canActivate(makeCtx('Bearer admin-jwt').ctx)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    await expect(adminGuard.canActivate(makeCtx('Bearer admin-jwt').ctx)).resolves.toBe(true);
  });

  it('configures 120 req/min Throttle metadata on the 4 read-only GET handlers', () => {
    const reflector = new Reflector();
    const readOnlyHandlers = [
      GrammarController.prototype.getLevels,
      GrammarController.prototype.getTree,
      GrammarController.prototype.listTopics,
      GrammarController.prototype.getTopicDetail,
    ];
    for (const handler of readOnlyHandlers) {
      expect(reflector.get<number>('THROTTLER:LIMITdefault', handler)).toBe(120);
      expect(reflector.get<number>('THROTTLER:TTLdefault', handler)).toBe(60000);
    }
    expect(reflector.get<number>('THROTTLER:LIMITdefault', GrammarController.prototype.getPracticeItems)).toBeUndefined();
  });
});
