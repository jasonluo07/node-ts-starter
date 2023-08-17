import { Router } from 'express';
import type { ResultSetHeader, RowDataPacket } from 'mysql2';
import z from 'zod';

import pool from '@/databases';
import { HttpCode } from '@/enums';
import { DatabaseError, UnauthorizedError } from '@/errors';
import { catchAsyncError } from '@/middlewares';
import { checkPassword, generateToken, hashPassword, sendResponse } from '@/utils';

const router = Router();

const signUpSchema = z
  .object({
    email: z.string().email({ message: 'Invalid email' }),
    password: z
      .string()
      .min(8, { message: 'Password must contain at least 8 character(s)' })
      .refine(
        (password) => {
          const hasUpperCase = /[A-Z]/.test(password);
          const hasLowerCase = /[a-z]/.test(password);
          const hasDigit = /\d/.test(password);
          return hasUpperCase && hasLowerCase && hasDigit;
        },
        {
          message: 'Password must contain at least 1 uppercase letter, 1 lowercase letter and 1 digit',
        }
      ),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Password and confirm password don't match",
    path: ['confirmPassword'],
  });

router.post(
  '/signup',
  catchAsyncError(async (req, res) => {
    const validationResult = signUpSchema.safeParse(req.body);

    if (!validationResult.success) {
      throw validationResult.error; // NOTE: Manually throw the ZodError
    }

    const { email, password } = validationResult.data;

    const [rows] = await pool.execute<RowDataPacket[]>('SELECT id FROM users WHERE email = ?', [email]);

    if (rows.length > 0) {
      throw new UnauthorizedError('Email already exists');
    }

    const hashedPassword = await hashPassword(password);

    const [result] = await pool.execute<ResultSetHeader>('INSERT INTO users (email, password) VALUES (?, ?)', [
      email,
      hashedPassword,
    ]);
    const { affectedRows, insertId } = result;

    if (affectedRows === 0) {
      throw new DatabaseError('User not created');
    }

    const token = generateToken({ userId: insertId, email });

    sendResponse({
      res,
      statusCode: HttpCode.CREATED,
      message: 'User created successfully',
      data: { token },
    });
  })
);

const signInSchema = z.object({
  email: z.string().email({ message: 'Invalid email' }),
  password: z
    .string()
    .min(8, { message: 'Password must contain at least 8 character(s)' })
    .refine(
      (password) => {
        const hasUpperCase = /[A-Z]/.test(password);
        const hasLowerCase = /[a-z]/.test(password);
        const hasDigit = /\d/.test(password);
        return hasUpperCase && hasLowerCase && hasDigit;
      },
      {
        message: 'Password must contain at least 1 uppercase letter, 1 lowercase letter and 1 digit',
      }
    ),
});

router.post(
  '/signin',
  catchAsyncError(async (req, res) => {
    const validationResult = signInSchema.safeParse(req.body);

    if (!validationResult.success) {
      throw validationResult.error; // NOTE: Manually throw the ZodError
    }

    const { email, password } = validationResult.data;

    const [rows] = await pool.execute<RowDataPacket[]>('SELECT id, password FROM users WHERE email = ?', [email]);

    if (rows.length === 0) {
      throw new UnauthorizedError('Invalid email or password');
    }

    const userId = rows[0].id;
    const storedHashedPassword = rows[0].password;
    const isPasswordValid = await checkPassword(password, storedHashedPassword);

    if (!isPasswordValid) {
      throw new UnauthorizedError('Invalid email or password');
    }

    const token = generateToken({ userId, email });
    sendResponse({
      res,
      statusCode: HttpCode.OK,
      message: 'Logged in successfully',
      data: { token },
    });
  })
);

export default router;
