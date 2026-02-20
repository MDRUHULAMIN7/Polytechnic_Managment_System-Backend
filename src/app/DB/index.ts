import config from "../config/index.js";
import { USER_ROLE } from "../modules/user/user.constant.js";
import { User } from "../modules/user/user.model.js";

const superUser = {
  id: '0001',
  email: 'ruhulofficial777@gmail.com',
  password: config.super_admin_password,
  needsPasswordChange: false,
  role: USER_ROLE.superAdmin,
  status: 'active',
  isDeleted: false,
};

const seedSuperAdmin = async () => {
  //when database is connected, we will check is there any user who is super admin
  const isSuperAdminExits = await User.findOne({ role: USER_ROLE.superAdmin });

  if (!isSuperAdminExits) {
    await User.create(superUser);
  }
};

export default seedSuperAdmin;