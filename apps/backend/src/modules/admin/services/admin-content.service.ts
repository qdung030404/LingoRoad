import { Injectable, Optional } from '@nestjs/common';
import {
  CEFR_CAN_DO_DESCRIPTORS,
  CanDoDescriptor,
} from '../../assessment/constants/cefr-can-do-matrix.constant';
import { AssessmentMatrixService } from '../../assessment/services/assessment-matrix.service';
import { MediaStorageService } from '../../media/media-storage.service';
import { PrismaService } from '../../prisma/prisma.service';
import {
  AdminAssessmentGroupsQueryDto,
  AdminAssessmentItemsQueryDto,
  AdminLessonsQueryDto,
  BulkPublishDto,
  CreateAdminAssessmentItemDto,
  CreateAdminLessonDto,
  CreateAssessmentItemGroupDto,
  CreateLearningUnitDto,
  UpdateAdminAssessmentItemDto,
  UpdateAdminLessonDto,
  UpdateAssessmentItemGroupDto,
  UpdateLearningUnitDto,
} from '../dto/admin-content.dto';
import { PaginatedResult } from './admin-users.service';
import {
  createAssessmentGroupOp,
  createAssessmentItemOp,
  deleteAssessmentGroupOp,
  deleteAssessmentItemOp,
  listAssessmentGroupsOp,
  listAssessmentItemsOp,
  updateAssessmentGroupOp,
  updateAssessmentItemOp,
} from './content/admin-content-assessment.helper';
import {
  bulkPublishLessonsOp,
  createLessonOp,
  createUnitOp,
  deleteLessonOp,
  deleteUnitOp,
  getLessonOp,
  listLessonsOp,
  listUnitsOp,
  updateLessonOp,
  updateUnitOp,
} from './content/admin-content-lessons.helper';
import {
  AdminAssessmentGroupView,
  AdminAssessmentItemView,
  AdminLessonDetail,
  AdminLessonSummary,
  AdminUnitItem,
  AssessmentItemsSummary,
  LessonsListSummary,
} from './content/admin-content.types';

export type {
  AdminAssessmentGroupView,
  AdminAssessmentItemView,
  AdminLessonDetail,
  AdminLessonSummary,
  AdminUnitItem,
  AssessmentItemsSummary,
  LessonsListSummary,
} from './content/admin-content.types';

@Injectable()
export class AdminContentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly assessmentMatrixService: AssessmentMatrixService,
    @Optional() private readonly mediaStorage?: MediaStorageService,
  ) {}

  listUnits(): Promise<AdminUnitItem[]> {
    return listUnitsOp(this.prisma);
  }

  createUnit(dto: CreateLearningUnitDto): Promise<AdminUnitItem> {
    return createUnitOp(this.prisma, dto);
  }

  updateUnit(id: string, dto: UpdateLearningUnitDto): Promise<AdminUnitItem> {
    return updateUnitOp(this.prisma, id, dto);
  }

  deleteUnit(
    id: string,
    detach = false,
  ): Promise<{ id: string; action: 'DELETED'; detachedLessonsCount: number }> {
    return deleteUnitOp(this.prisma, id, detach);
  }

  listLessons(
    query: AdminLessonsQueryDto,
  ): Promise<PaginatedResult<AdminLessonSummary, LessonsListSummary>> {
    return listLessonsOp(this.prisma, query);
  }

  getLesson(id: string): Promise<AdminLessonDetail> {
    return getLessonOp(this.prisma, id);
  }

  createLesson(dto: CreateAdminLessonDto): Promise<AdminLessonDetail> {
    return createLessonOp(this.prisma, dto, this.mediaStorage);
  }

  updateLesson(
    id: string,
    dto: UpdateAdminLessonDto,
  ): Promise<AdminLessonDetail> {
    return updateLessonOp(this.prisma, id, dto, this.mediaStorage);
  }

  deleteLesson(
    id: string,
    force = false,
  ): Promise<{
    id: string;
    action: 'DELETED' | 'UNPUBLISHED';
    attemptsCount: number;
  }> {
    return deleteLessonOp(this.prisma, id, force);
  }

  bulkPublishLessons(
    dto: BulkPublishDto,
  ): Promise<{ updatedCount: number; published: boolean; ids: string[] }> {
    return bulkPublishLessonsOp(this.prisma, dto, this.mediaStorage);
  }

  listDescriptors(): readonly CanDoDescriptor[] {
    return CEFR_CAN_DO_DESCRIPTORS;
  }

  listAssessmentItems(
    query: AdminAssessmentItemsQueryDto,
  ): Promise<PaginatedResult<AdminAssessmentItemView, AssessmentItemsSummary>> {
    return listAssessmentItemsOp(this.prisma, query);
  }

  createAssessmentItem(
    dto: CreateAdminAssessmentItemDto,
  ): Promise<AdminAssessmentItemView> {
    return createAssessmentItemOp(
      this.prisma,
      this.assessmentMatrixService,
      dto,
      this.mediaStorage,
    );
  }

  updateAssessmentItem(
    id: string,
    dto: UpdateAdminAssessmentItemDto,
  ): Promise<AdminAssessmentItemView> {
    return updateAssessmentItemOp(
      this.prisma,
      this.assessmentMatrixService,
      id,
      dto,
      this.mediaStorage,
    );
  }

  deleteAssessmentItem(
    id: string,
    force = false,
  ): Promise<{ id: string; action: 'DELETED' }> {
    return deleteAssessmentItemOp(
      this.prisma,
      this.assessmentMatrixService,
      id,
      force,
    );
  }

  listAssessmentGroups(
    query: AdminAssessmentGroupsQueryDto,
  ): Promise<PaginatedResult<AdminAssessmentGroupView>> {
    return listAssessmentGroupsOp(this.prisma, query);
  }

  createAssessmentGroup(
    dto: CreateAssessmentItemGroupDto,
  ): Promise<AdminAssessmentGroupView> {
    return createAssessmentGroupOp(
      this.prisma,
      this.assessmentMatrixService,
      dto,
    );
  }

  updateAssessmentGroup(
    id: string,
    dto: UpdateAssessmentItemGroupDto,
  ): Promise<AdminAssessmentGroupView> {
    return updateAssessmentGroupOp(
      this.prisma,
      this.assessmentMatrixService,
      id,
      dto,
    );
  }

  deleteAssessmentGroup(
    id: string,
  ): Promise<{ id: string; action: 'DELETED'; detachedItemsCount: number }> {
    return deleteAssessmentGroupOp(
      this.prisma,
      this.assessmentMatrixService,
      id,
    );
  }
}
