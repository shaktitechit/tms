import mongoose from 'mongoose';
import { mongoRegistry } from '../../data/mongoRegistry.js';
import type { MemberModuleDocument } from '../../models/index.js';

const MODULE_POPULATE = { path: 'moduleId', select: 'name slug departmentId' } as const;

export const memberModuleRepository = {
  findById(id: string) {
    return mongoRegistry.models.MemberModule.findById(id).populate(MODULE_POPULATE);
  },

  findByUser(tenantId: string, userId: string) {
    return mongoRegistry.models.MemberModule.find({ tenantId, userId })
      .populate(MODULE_POPULATE)
      .sort({ createdAt: 1 });
  },

  findByUserIds(tenantId: string, userIds: string[]) {
    if (userIds.length === 0) {
      return Promise.resolve([]);
    }
    return mongoRegistry.models.MemberModule.find({
      tenantId,
      userId: { $in: userIds },
    })
      .populate(MODULE_POPULATE)
      .sort({ createdAt: 1 });
  },

  findOne(tenantId: string, userId: string, moduleId: string) {
    return mongoRegistry.models.MemberModule.findOne({ tenantId, userId, moduleId }).populate(
      MODULE_POPULATE,
    );
  },

  create(data: Partial<MemberModuleDocument>) {
    return mongoRegistry.models.MemberModule.create(data);
  },

  async insertMany(
    rows: Array<{
      userId: mongoose.Types.ObjectId;
      moduleId: mongoose.Types.ObjectId;
      departmentId?: mongoose.Types.ObjectId | null;
      tenantId: mongoose.Types.ObjectId;
    }>,
  ) {
    if (rows.length === 0) {
      return [];
    }
    await mongoRegistry.models.MemberModule.insertMany(rows, { ordered: false });
    return mongoRegistry.models.MemberModule.find({
      tenantId: rows[0]?.tenantId,
      userId: rows[0]?.userId,
    })
      .populate(MODULE_POPULATE)
      .sort({ createdAt: 1 });
  },

  deleteById(id: string, tenantId: string) {
    return mongoRegistry.models.MemberModule.findOneAndDelete({ _id: id, tenantId });
  },

  deleteByUser(tenantId: string, userId: string) {
    return mongoRegistry.models.MemberModule.deleteMany({ tenantId, userId });
  },

  deleteByModuleId(tenantId: string, moduleId: string) {
    return mongoRegistry.models.MemberModule.deleteMany({ tenantId, moduleId });
  },

  deleteByModuleIds(tenantId: string, moduleIds: mongoose.Types.ObjectId[]) {
    if (moduleIds.length === 0) {
      return Promise.resolve({ deletedCount: 0 });
    }
    return mongoRegistry.models.MemberModule.deleteMany({
      tenantId,
      moduleId: { $in: moduleIds },
    });
  },

  deleteMany(query: { tenantId: string; userId: string; moduleId?: { $nin: mongoose.Types.ObjectId[] } }) {
    return mongoRegistry.models.MemberModule.deleteMany(query);
  },
};
