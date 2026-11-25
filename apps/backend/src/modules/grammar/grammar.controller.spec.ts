import { ExecutionContext, UnauthorizedException, ValidationPipe } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import { ThrottlerGuard } from '@nestjs/throttler';
import { FirebaseTokenService } from '../auth/firebase/firebase-token.service';
import { FirebaseUserService } from '../auth/firebase/firebase-user.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
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
        RolesGuard,
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

  it('enforces OptionalJwtAuthGuard for anonymous vs malformed vs valid Firebase tokens and RolesGuard for ADMIN', async () => {
    const firebaseToken = {
      enabled: true,
      verify: jest.fn().mockResolvedValue({ uid: 'fb-1' }),
    } as unknown as FirebaseTokenService;
    const firebaseUsers = {
      resolve: jest.fn().mockResolvedValue({ sub: 'user-1', role: 'LEARNER' }),
    } as unknown as FirebaseUserService;

    const optionalGuard = new OptionalJwtAuthGuard(firebaseToken, firebaseUsers);
    const makeCtx = (authorization?: string, role?: string) => {
      const req: { headers: { authorization?: string }; user?: { sub: string; role?: string } } = {
        headers: { ...(authorization ? { authorization } : {}) },
        ...(role ? { user: { sub: 'u-1', role } } : {}),
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

    // RolesGuard blocks LEARNER and allows ADMIN on GrammarAdminController
    const rolesGuard = new RolesGuard(new Reflector());
    expect(() => rolesGuard.canActivate(makeCtx(undefined, 'LEARNER').ctx)).toThrow();
    expect(rolesGuard.canActivate(makeCtx(undefined, 'ADMIN').ctx)).toBe(true);
  });
});
