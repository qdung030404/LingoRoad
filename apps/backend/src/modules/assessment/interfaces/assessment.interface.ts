import {
  AssessmentItem as PrismaAssessmentItem,
  AssessmentItemGroup as PrismaAssessmentItemGroup,
} from "@prisma/client";

export type AssessmentItemGroupWithItems = PrismaAssessmentItemGroup & {
  items: PrismaAssessmentItem[];
};
