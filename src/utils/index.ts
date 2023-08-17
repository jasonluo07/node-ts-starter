import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

import { SALT_ROUNDS } from '@/constants';

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function checkPassword(password: string, hashPassword: string): Promise<boolean> {
  return bcrypt.compare(password, hashPassword);
}

export function generateToken(email: string): string {
  return jwt.sign({ email }, process.env.JWT_SECRET!, { expiresIn: process.env.JWT_EXPIRES_IN });
}

// TODO: ChatGPT 使用 try-catch
export function verifyToken(token: string) {
  return jwt.verify(token, process.env.JWT_SECRET!);
}
