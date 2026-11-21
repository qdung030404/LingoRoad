import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { LearningContent } from '../../src/modules/learning/learning.types';

/** Runtime content is separate from the six unrecorded editorial drafts. */
export function loadCampusCafeListening(): LearningContent {
  return JSON.parse(readFileSync(join(__dirname, 'campus-cafe-v1.json'), 'utf8')) as LearningContent;
}
