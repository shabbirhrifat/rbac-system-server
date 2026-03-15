import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { hashPassword, verifyPassword } from '../auth/utils/password.util';
import { PrismaService } from '../database/prisma.service';
import { UpdateAppSettingsDto } from './dto/update-app-settings.dto';
import { UpdateProfileSettingsDto } from './dto/update-profile-settings.dto';

@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async getProfileSettings(userId: string) {
    return this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        status: true,
        userSetting: {
          select: {
            timezone: true,
            locale: true,
            sidebarCollapsed: true,
            updatedAt: true,
          },
        },
      },
    });
  }

  async updateProfileSettings(userId: string, dto: UpdateProfileSettingsDto) {
    const passwordHash = await this.resolvePasswordHash(userId, dto);

    return this.prisma.user.update({
      where: { id: userId },
      data: {
        firstName: dto.firstName?.trim(),
        lastName: dto.lastName?.trim(),
        phone: dto.phone?.trim() || undefined,
        passwordHash,
        userSetting: {
          upsert: {
            create: {
              timezone: dto.timezone ?? 'UTC',
              locale: dto.locale ?? 'en',
              sidebarCollapsed: dto.sidebarCollapsed ?? false,
            },
            update: {
              timezone: dto.timezone,
              locale: dto.locale,
              sidebarCollapsed: dto.sidebarCollapsed,
            },
          },
        },
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        userSetting: {
          select: {
            timezone: true,
            locale: true,
            sidebarCollapsed: true,
            updatedAt: true,
          },
        },
      },
    });
  }

  async getAppSettings(userId: string) {
    await this.assertAdmin(userId);

    const items = await this.prisma.appSetting.findMany({
      orderBy: { key: 'asc' },
      select: {
        key: true,
        value: true,
        updatedAt: true,
        updatedByUser: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    return { items };
  }

  async updateAppSettings(
    userId: string,
    key: string,
    dto: UpdateAppSettingsDto,
  ) {
    await this.assertAdmin(userId);
    const appSettingValue = dto.value as Prisma.InputJsonValue;

    return this.prisma.appSetting.upsert({
      where: { key },
      update: {
        value: appSettingValue,
        updatedBy: userId,
      },
      create: {
        key,
        value: appSettingValue,
        updatedBy: userId,
      },
      select: {
        key: true,
        value: true,
        updatedAt: true,
      },
    });
  }

  private async assertAdmin(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        role: {
          select: { key: true },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.role.key !== 'admin') {
      throw new ForbiddenException('App settings require admin access');
    }
  }

  private async resolvePasswordHash(
    userId: string,
    dto: UpdateProfileSettingsDto,
  ): Promise<string | undefined> {
    if (!dto.currentPassword && !dto.newPassword) {
      return undefined;
    }

    if (!dto.currentPassword || !dto.newPassword) {
      throw new BadRequestException(
        'Both currentPassword and newPassword are required',
      );
    }

    if (dto.newPassword.length < 8) {
      throw new BadRequestException(
        'newPassword must be at least 8 characters',
      );
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { passwordHash: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const passwordMatches = await verifyPassword(
      dto.currentPassword,
      user.passwordHash,
    );

    if (!passwordMatches) {
      throw new BadRequestException('Current password is incorrect');
    }

    return hashPassword(dto.newPassword);
  }
}
