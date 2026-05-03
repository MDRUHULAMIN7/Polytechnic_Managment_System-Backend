import jwt, { type Secret, type SignOptions ,type JwtPayload } from 'jsonwebtoken';

export const createToken = (
  jwtPayload: Record<string, unknown>,
  secret: Secret,
  expiresIn: SignOptions['expiresIn'],
) => {
  return jwt.sign(jwtPayload, secret, {
    expiresIn,
  });
};

export const verifyToken = (token: string, secret: string) => {
  return jwt.verify(token, secret) as JwtPayload;
};
