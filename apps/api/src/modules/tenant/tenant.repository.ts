import { slugifySegment } from '@video/shared';
import { mongoRegistry } from '../../data/mongoRegistry.js';

export const tenantRepository = {
  findById(id: string) {
    return mongoRegistry.models.Tenant.findById(id);
  },

  findBySlug(slug: string) {
    return mongoRegistry.models.Tenant.findOne({ slug: slug.toLowerCase() });
  },

  async createUnique(name: string) {
    const base = slugifySegment(name, 'tenant');
    let slug = base;
    let attempt = 0;

    while (attempt < 8) {
      try {
        return await mongoRegistry.models.Tenant.create({ name, slug });
      } catch (error) {
        const isDuplicate =
          typeof error === 'object' &&
          error !== null &&
          'code' in error &&
          (error as { code?: number }).code === 11000;
        if (!isDuplicate) {
          throw error;
        }
        attempt += 1;
        slug = `${base}-${Math.random().toString(36).slice(2, 8)}`;
      }
    }

    throw new Error('Failed to allocate a unique tenant slug');
  },

  updateById(id: string, patch: { name?: string; logoStorageKey?: string }) {
    return mongoRegistry.models.Tenant.findByIdAndUpdate(id, patch, { new: true });
  },
};
