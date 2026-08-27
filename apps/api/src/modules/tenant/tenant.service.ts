import { ERROR_CODES } from '@video/shared';
import { forbidden, notFound } from '../../http/errors.js';
import type { AppContext } from '../../types.js';
import { serializeTenant } from './tenant.serializer.js';
import { tenantRepository } from './tenant.repository.js';
import { logoExtension, type ParsedTenantLogo } from './tenant.form.parser.js';

export class TenantService {
  constructor(private readonly ctx: AppContext) {}

  async getForUser(user: { tenantId: string }) {
    const tenant = await tenantRepository.findById(user.tenantId);
    if (!tenant) {
      throw notFound('Tenant not found', ERROR_CODES.NOT_FOUND);
    }
    return serializeTenant(tenant);
  }

  async updateForUser(
    user: { id: string; role: string; tenantId: string },
    patch: { name: string },
    logo?: ParsedTenantLogo,
  ) {
    if (user.role !== 'tenant') {
      throw forbidden();
    }

    const updates: { name: string; logoStorageKey?: string } = { name: patch.name.trim() };
    if (logo) {
      updates.logoStorageKey = await this.uploadLogo(user.tenantId, logo);
    }

    const tenant = await tenantRepository.updateById(user.tenantId, updates);
    if (!tenant) {
      throw notFound('Tenant not found', ERROR_CODES.NOT_FOUND);
    }
    return serializeTenant(tenant);
  }

  async pipeLogo(user: { tenantId: string }, res: import('express').Response) {
    const tenant = await tenantRepository.findById(user.tenantId);
    if (!tenant?.logoStorageKey) {
      throw notFound('Logo not found', ERROR_CODES.NOT_FOUND);
    }

    const exists = await this.ctx.storage.exists(tenant.logoStorageKey);
    if (!exists) {
      throw notFound('Logo not found', ERROR_CODES.NOT_FOUND);
    }

    const metadata = await this.ctx.storage.getMetadata(tenant.logoStorageKey);
    res.setHeader('Content-Type', metadata.contentType ?? 'image/jpeg');
    if (metadata.contentLength) {
      res.setHeader('Content-Length', String(metadata.contentLength));
    }
    res.setHeader('Cache-Control', 'private, max-age=86400');

    const body = await this.ctx.storage.download(tenant.logoStorageKey);
    body.pipe(res);
  }

  private async uploadLogo(tenantId: string, file: ParsedTenantLogo) {
    await this.ctx.storage.deletePrefix(`tenants/${tenantId}/`);
    const key = `tenants/${tenantId}/logo${logoExtension(file.mimeType)}`;
    await this.ctx.storage.upload(key, file.stream, {
      contentType: file.mimeType,
      contentLength: file.size > 0 ? file.size : undefined,
    });
    return key;
  }
}
