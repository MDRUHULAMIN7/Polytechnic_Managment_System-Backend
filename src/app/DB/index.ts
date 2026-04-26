import config from "../config/index.js";
import { USER_ROLE } from "../modules/user/user.constant.js";
import { User } from "../modules/user/user.model.js";
import { logger } from "../utils/logger.js";

const seedSuperAdmin = async () => {
  if (!config.super_admin_seed_enabled) {
    logger.info('Super-admin seeding is disabled.');
    return;
  }

  if (!config.super_admin_password) {
    logger.warn(
      'Super-admin seeding skipped because SUPER_ADMIN_PASSWORD is not configured.',
    );
    return;
  }

  //when database is connected, we will check is there any user who is super admin
  const isSuperAdminExits = await User.findOne({ role: USER_ROLE.superAdmin });

  if (!isSuperAdminExits) {
    await User.create({
      id: config.super_admin_id,
      email: config.super_admin_email,
      password: config.super_admin_password,
      needsPasswordChange: true,
      role: USER_ROLE.superAdmin,
      status: 'active',
      isDeleted: false,
    });
    logger.warn('Seeded bootstrap super-admin account with forced password rotation.', {
      superAdminId: config.super_admin_id,
      superAdminEmail: config.super_admin_email,
    });
  }
};

export default seedSuperAdmin;
