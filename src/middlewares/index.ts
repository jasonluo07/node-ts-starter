import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { ZodError } from 'zod';

import { HttpCode } from '@/enums';
import { DatabaseError, NotFoundError, UnauthorizedError } from '@/errors';
import type { AuthenticatedRequest } from '@/types';
import { isDbError, sendResponse } from '@/utils';

type AsyncFunction = (req: Request, res: Response, next: NextFunction) => Promise<void>;
export function catchAsyncError(fn: AsyncFunction) {
  return (req: Request, res: Response, next: NextFunction) =>
    Promise.resolve(fn(req, res, next)).catch((err) => {
      if (err instanceof Error && isDbError(err.message)) {
        next(new DatabaseError('Database error, please try contacting the administrator'));
      } else {
        next(err);
      }
    });
}

export function authenticate(req: AuthenticatedRequest, _res: Response, next: NextFunction): void {
  const { authorization } = req.headers;

  if (!authorization || !authorization.startsWith('Bearer ')) {
    throw new UnauthorizedError('Authorization header is required or malformed');
  }

  const token = authorization.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { email: string };
    const { email } = decoded;
    req.user = { email };
    next();
  } catch (err) {
    throw new UnauthorizedError('Invalid token');
  }
}

function formatZodError(error: ZodError): string {
  return error.issues.map((issue) => issue.message).join('\n');
}

// NOTE: _next is required for express to recognize this as an error handling middleware
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  // NOTE: ZodError must be checked before Error because ZodError is an instance of Error
  if (err instanceof NotFoundError) {
    sendResponse({
      res,
      statusCode: HttpCode.NOT_FOUND,
      message: err.message,
    });
  } else if (err instanceof UnauthorizedError) {
    sendResponse({
      res,
      statusCode: HttpCode.UNAUTHORIZED,
      message: err.message,
    });
  } else if (err instanceof DatabaseError) {
    sendResponse({
      res,
      statusCode: HttpCode.INTERNAL_SERVER_ERROR,
      message: err.message,
    });
  } else if (err instanceof ZodError) {
    const errorMessages = formatZodError(err);
    sendResponse({
      res,
      statusCode: HttpCode.BAD_REQUEST,
      message: errorMessages,
    });
  } else if (err instanceof Error) {
    sendResponse({
      res,
      statusCode: HttpCode.INTERNAL_SERVER_ERROR,
      message: err.message,
    });
  } else {
    sendResponse({
      res,
      statusCode: HttpCode.INTERNAL_SERVER_ERROR,
      message: 'Internal server error',
    });
  }
}