import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ProfileService } from './profile.service';

describe('ProfileService', () => {
  const account = {
    id: 'owner',
    email: 'learner@example.com',
    name: 'Learner',
    profile: {
      onboardingCompletedAt: null as Date | null,
      preferencesVersion: 0,
      reminderEnabled: true,
      reminderTime: '19:30',
      reminderVersion: 0,
    },
  };
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
    expect(update.preferencesVersion).toEqual({ increment: 1 });
  });

  it('does not complete onboarding or require expectedVersion for a name-only edit', async () => {
    await service.update('owner', { name: 'Updated Name' });
    const args = user.update.mock.calls[0][0];
    expect(args.data.name).toBe('Updated Name');
    expect(args.data.profile.upsert.update).not.toHaveProperty('onboardingCompletedAt');
    expect(args.data.profile.upsert.update).not.toHaveProperty('preferencesVersion');
  });

  it('updates user avatarUrl directly without requiring expectedVersion or touching goals', async () => {
    user.findUnique.mockResolvedValue({
      ...account,
      profile: { ...account.profile, onboardingCompletedAt: new Date('2026-10-19'), preferencesVersion: 2 },
    });
    await service.update('owner', { avatarUrl: 'https://cdn.example.com/avatar.jpg' });
    const args = user.update.mock.calls[0][0];
    expect(args.data.avatarUrl).toBe('https://cdn.example.com/avatar.jpg');
    expect(args.data.profile.upsert.update).not.toHaveProperty('preferencesVersion');
  });

  it('preserves the first onboarding completion date when expectedVersion matches', async () => {
    user.findUnique.mockResolvedValue({
      ...account,
      profile: { ...account.profile, onboardingCompletedAt: new Date('2026-10-19'), preferencesVersion: 0 },
    });
    await service.update('owner', { learningPurpose: 'WORK', dailyGoalMinutes: 20, expectedVersion: 0 });
    const update = user.update.mock.calls[0][0].data.profile.upsert.update;
    expect(update).not.toHaveProperty('onboardingCompletedAt');
    expect(update.preferencesVersion).toEqual({ increment: 1 });
  });

  it('increments preferencesVersion when only learningPurpose or targetCefr changes after onboarding', async () => {
    user.findUnique.mockResolvedValue({
      ...account,
      profile: {
        ...account.profile,
        onboardingCompletedAt: new Date('2026-10-19'),
        learningPurpose: 'STUDY',
        targetCefr: 'B1',
        preferencesVersion: 2,
      },
    });
    await service.update('owner', { learningPurpose: 'WORK', expectedVersion: 2 });
    const update = user.update.mock.calls[0][0].data.profile.upsert.update;
    expect(update.preferencesVersion).toEqual({ increment: 1 });

    await service.update('owner', { targetCefr: 'B2', expectedVersion: 2 });
    expect(user.update.mock.calls[1][0].data.profile.upsert.update.preferencesVersion).toEqual({ increment: 1 });
  });

  it('requires expectedVersion and rejects stale expectedVersion when editing goals after onboarding', async () => {
    user.findUnique.mockResolvedValue({
      ...account,
      profile: { ...account.profile, onboardingCompletedAt: new Date('2026-10-19'), preferencesVersion: 3 },
    });
    await expect(service.update('owner', { learningPurpose: 'WORK' })).rejects.toThrow(BadRequestException);
    await expect(service.update('owner', { learningPurpose: 'WORK', expectedVersion: 2 })).rejects.toThrow(ConflictException);
    expect(user.update).not.toHaveBeenCalled();
  });

  it('prevents stale reminder requests from overwriting newer reminder settings via expectedReminderVersion', async () => {
    user.findUnique.mockResolvedValue({
      ...account,
      profile: {
        ...account.profile,
        onboardingCompletedAt: new Date('2026-10-19'),
        reminderEnabled: true,
        reminderTime: '21:00',
        reminderVersion: 1,
      },
    });
    await expect(
      service.update('owner', { reminderTime: '20:00' }),
    ).rejects.toThrow(BadRequestException);
    await expect(
      service.update('owner', { reminderTime: '20:00', expectedReminderVersion: 0 }),
    ).rejects.toThrow(ConflictException);
    expect(user.update).not.toHaveBeenCalled();

    await service.update('owner', { reminderTime: '20:30', expectedReminderVersion: 1 });
    const update = user.update.mock.calls[0][0].data.profile.upsert.update;
    expect(update.reminderTime).toBe('20:30');
    expect(update.reminderVersion).toEqual({ increment: 1 });
  });

  it('rejects a missing account', async () => {
    user.findUnique.mockResolvedValue(null);
    await expect(service.update('unknown', { name: 'Updated' })).rejects.toThrow(NotFoundException);
    expect(user.update).not.toHaveBeenCalled();
  });

  it.each([
    { name: null }, { name: ' ' }, { avatarUrl: 'not-a-url' }, { avatarUrl: 'javascript:alert(1)' },
    { avatarUrl: 'http://cdn.example.com/a.png' },
    { avatarUrl: 'http://localhost:3000/a.png' }, { avatarUrl: 'http://127.0.0.1/a.png' },
    { avatarUrl: 'http://169.254.169.254/latest/meta-data/' },
    { avatarUrl: 'https://user:pass@cdn.example.com/a.png' }, { avatarUrl: 'http://[::1]/a.png' },
    { learningPurpose: null }, { learningPurpose: 'OTHER' },
    { dailyGoalMinutes: null }, { dailyGoalMinutes: 4 }, { dailyGoalMinutes: 121 },
    { dailyGoalMinutes: 10.5 }, { selfAssessedCefr: 'C2' },
    { targetCefr: 'C2' }, { reminderTime: '25:00' }, { reminderTime: '9:30' },
  ])('rejects invalid profile fields %p', async (input) => {
    expect(await validate(plainToInstance(UpdateProfileDto, input))).not.toHaveLength(0);
  });

  it('accepts unknown self-assessment, valid reminderTime, public/null avatarUrl and trims the name', async () => {
    const dto = plainToInstance(UpdateProfileDto, {
      name: '  Learner  ',
      avatarUrl: 'https://cdn.example.com/avatar.png',
      learningPurpose: 'EXAM',
      targetCefr: 'B2',
      dailyGoalMinutes: 5,
      selfAssessedCefr: null,
      reminderTime: '07:45',
    });
    expect(await validate(dto)).toHaveLength(0);
    expect(dto.name).toBe('Learner');
    expect(await validate(plainToInstance(UpdateProfileDto, { avatarUrl: null }))).toHaveLength(0);
  });
});
