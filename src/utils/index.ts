import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

import { SALT_ROUNDS } from '@/constants';
import { HttpCode } from '@/enums';
import { ApiResponse, ApiResponseStatus, SendResponseParams, UserPayload } from '@/types';

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function checkPassword(password: string, hashPassword: string): Promise<boolean> {
  return bcrypt.compare(password, hashPassword);
}

// email + id
export function generateToken(payload: UserPayload): string {
  return jwt.sign(payload, process.env.JWT_SECRET!, { expiresIn: process.env.JWT_EXPIRES_IN });
}

// TODO: ChatGPT 使用 try-catch
export function verifyToken(token: string) {
  return jwt.verify(token, process.env.JWT_SECRET!);
}

const dbErrorKeywords = ['SQL syntax', 'MySQL'];
export function isDbError(message: string): boolean {
  return dbErrorKeywords.some((keyword) => message.includes(keyword));
}

const statusMapping: Record<HttpCode, ApiResponseStatus> = {
  // success
  [HttpCode.OK]: 'success',
  [HttpCode.CREATED]: 'success',
  // error
  [HttpCode.BAD_REQUEST]: 'error',
  [HttpCode.UNAUTHORIZED]: 'error',
  [HttpCode.NOT_FOUND]: 'error',
  [HttpCode.INTERNAL_SERVER_ERROR]: 'error',
};

export function sendResponse<T>({ res, statusCode, message, data }: SendResponseParams<T>): void {
  const status = statusMapping[statusCode];
  const response: ApiResponse<T> = {
    status,
    message,
    data,
  };
  res.status(statusCode).json(response);
}
