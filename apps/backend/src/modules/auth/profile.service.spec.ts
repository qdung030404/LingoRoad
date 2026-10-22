import { NotFoundException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ProfileService } from './profile.service';

describe('ProfileService', () => {
  const account = { id: 'owner', email: 'learner@example.com', name: 'Learner', profile: { onboardingCompletedAt: null } };
  let service: ProfileService;
  let user: { findUnique: jest.Mock; update: jest.Mock };

  beforeEach(() => {
    user = { findUnique: jest.fn(async () => account), update: jest.fn(async () => account) };
    service = new ProfileService({ user } as unknown as PrismaService);
  });

  it('loads only safe account fields', async () => {
    expect(await service.get('owner')).toEqual(account);
    const select = user.findUnique.mock.calls[0][0].select;
    expect(select).not.toHaveProperty('passwordHash');
    expect(select).not.toHaveProperty('refreshSessions');
    expect(select.profile).toBe(true);
  });

  it('marks onboarding complete only when purpose and daily goal are explicitly supplied', async () => {
    await service.update('owner', { learningPurpose: 'STUDY', dailyGoalMinutes: 10, selfAssessedCefr: null });
    const update = user.update.mock.calls[0][0].data.profile.upsert.update;
    expect(update.onboardingCompletedAt).toBeInstanceOf(Date);
    expect(update.selfAssessedCefr).toBeNull();
  });

  it('does not complete onboarding for a name-only edit', async () => {
    await service.update('owner', { name: 'Updated Name' });
    const args = user.update.mock.calls[0][0];
    expect(args.data.name).toBe('Updated Name');
    expect(args.data.profile.upsert.update).not.toHaveProperty('onboardingCompletedAt');
  });

  it('preserves the first onboarding completion date', async () => {
    user.findUnique.mockResolvedValue({ ...account, profile: { onboardingCompletedAt: new Date('2026-10-19') } });
    await service.update('owner', { learningPurpose: 'WORK', dailyGoalMinutes: 20 });
    expect(user.update.mock.calls[0][0].data.profile.upsert.update).not.toHaveProperty('onboardingCompletedAt');
  });

  it('rejects a missing account', async () => {
    user.findUnique.mockResolvedValue(null);
    await expect(service.update('unknown', { name: 'Updated' })).rejects.toThrow(NotFoundException);
    expect(user.update).not.toHaveBeenCalled();
  });

  it.each([
    { name: null }, { name: ' ' }, { learningPurpose: null }, { learningPurpose: 'OTHER' },
    { dailyGoalMinutes: null }, { dailyGoalMinutes: 4 }, { dailyGoalMinutes: 121 },
    { dailyGoalMinutes: 10.5 }, { selfAssessedCefr: 'C2' },
  ])('rejects invalid profile fields %p', async (input) => {
    expect(await validate(plainToInstance(UpdateProfileDto, input))).not.toHaveLength(0);
  });

  it('accepts unknown self-assessment and trims the name', async () => {
    const dto = plainToInstance(UpdateProfileDto, { name: '  Learner  ', learningPurpose: 'EXAM', dailyGoalMinutes: 5, selfAssessedCefr: null });
    expect(await validate(dto)).toHaveLength(0);
    expect(dto.name).toBe('Learner');
  });
});
