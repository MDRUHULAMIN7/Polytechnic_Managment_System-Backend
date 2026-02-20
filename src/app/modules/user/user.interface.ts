import { Model } from 'mongoose';
import type { USER_ROLE } from './user.constant.js';

export type TUser = {
    id : string;
    password : string;
    email : string;
    needsPasswordChange : boolean;
    passwordChangedAt?: Date;
    role : 'admin' | 'student' | 'instructor' |'superAdmin';
    status?: "active" | "blocked";
    isDeleted : boolean;

}
export interface UserModel extends Model<TUser> {
  //instance methods for checking if the user exist
  isUserExistsByCustomId(id: string): Promise<TUser>;
  //instance methods for checking if passwords are matched
  isPasswordMatched(
    plainTextPassword: string,
    hashedPassword: string,
  ): Promise<boolean>;
  isJWTIssuedBeforePasswordChanged(
    passwordChangedTimestamp: Date,
    jwtIssuedTimestamp: number,
  ): boolean;
}

export type TUserRole = keyof typeof USER_ROLE;
