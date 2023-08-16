import './config';

import type { NextFunction, Request, Response } from 'express';
import express from 'express';
import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { z, ZodError } from 'zod';

import pool from './databases';
import { checkPassword, generateToken, hashPassword } from './utils';

const app = express();

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

class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NotFoundError';
  }
}

class UnauthorizedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UnauthorizedError';
  }
}

class DatabaseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DatabaseError';
  }
}

app.use(express.json());

enum HttpCode {
  OK = 200,
  CREATED = 201,
  BAD_REQUEST = 400,
  UNAUTHORIZED = 401,
  NOT_FOUND = 404,
  INTERNAL_SERVER_ERROR = 500,
}

type ApiResponseStatus = 'success' | 'error';

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

interface Product {
  id: number;
  name: string;
  original_price: number;
  discount_price: number;
  description: string;
}

interface ApiResponse<T> {
  status: ApiResponseStatus;
  message: string;
  data?: T;
}

interface SendResponseParams<T> {
  res: Response;
  statusCode: HttpCode;
  message: string;
  data?: T;
}

function sendResponse<T>({ res, statusCode, message, data }: SendResponseParams<T>): void {
  const status = statusMapping[statusCode];
  const response: ApiResponse<T> = {
    status,
    message,
    data,
  };
  res.status(statusCode).json(response);
}

app.get(
  '/products',
  catchAsyncError(async (_req, res) => {
    const [rows] = await pool.execute<RowDataPacket[]>(
      'SELECT id, name, original_price, discount_price, description FROM products'
    );

    const products = rows as Product[];

    sendResponse({
      res,
      statusCode: HttpCode.OK,
      message: 'Products retrieved successfully',
      data: products,
    });
  })
);

app.get(
  '/products/:productId',
  catchAsyncError(async (req, res) => {
    const { productId } = req.params;

    const [rows] = await pool.execute<RowDataPacket[]>(
      'SELECT id, name, original_price, discount_price, description FROM products WHERE id = ?',
      [productId]
    );

    if (rows.length === 0) {
      throw new NotFoundError('Product not found');
    }

    const product = rows[0] as Product;

    sendResponse({
      res,
      statusCode: HttpCode.OK,
      message: 'Product retrieved successfully',
      data: product,
    });
  })
);

app.post(
  '/products',
  catchAsyncError(async (req, res) => {
    const { name, original_price, discount_price }: Omit<Product, 'id'> = req.body;

    const [result] = await pool.execute<ResultSetHeader>(
      'INSERT INTO products (name, original_price, discount_price) VALUES (?, ?, ?)',
      [name, original_price, discount_price]
    );
    const { affectedRows, insertId } = result;

    if (affectedRows === 0) {
      throw new DatabaseError('Product not created');
    }

    sendResponse({
      res,
      statusCode: HttpCode.CREATED,
      message: 'Product created',
      data: { id: insertId },
    });
  })
);

app.put(
  '/products/:productId',
  catchAsyncError(async (req, res) => {
    const { productId } = req.params;
    const { name, original_price, discount_price, description }: Omit<Product, 'id'> = req.body;

    const [result] = await pool.execute<ResultSetHeader>(
      'UPDATE products SET name = ?, original_price = ?, discount_price = ?, description = ? WHERE id = ?',
      [name, original_price, discount_price, description, productId]
    );
    const { affectedRows } = result;

    if (affectedRows === 0) {
      throw new NotFoundError('Product not found');
    }

    sendResponse({
      res,
      statusCode: HttpCode.OK,
      message: 'Product updated',
    });
  })
);

app.delete(
  '/products/:productId',
  catchAsyncError(async (req, res) => {
    const { productId } = req.params;

    const [result] = await pool.execute<ResultSetHeader>('DELETE FROM products WHERE id = ?', [productId]);
    const { affectedRows } = result;

    if (affectedRows === 0) {
      throw new NotFoundError('Product not found');
    }

    sendResponse({
      res,
      statusCode: HttpCode.OK,
      message: 'Product deleted',
    });
  })
);

function formatZodError(error: z.ZodError): string {
  return error.issues.map((issue) => issue.message).join('\n');
}

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

app.post(
  '/auth/signup',
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

    // result = {
    //   fieldCount: 0,
    //   affectedRows: 1,
    //   insertId: 102,
    //   info: '',
    //   serverStatus: 2,
    //   warningStatus: 0,
    //   changedRows: 0
    // }

    if (result.affectedRows === 0) {
      throw new DatabaseError('User not created');
    }

    const token = generateToken(email);

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

app.post(
  '/auth/signin',
  catchAsyncError(async (req, res) => {
    const validationResult = signInSchema.safeParse(req.body);

    if (!validationResult.success) {
      throw validationResult.error; // NOTE: Manually throw the ZodError
    }

    const { email, password } = validationResult.data;

    const [rows] = await pool.execute<RowDataPacket[]>('SELECT password FROM users WHERE email = ?', [email]);

    if (rows.length === 0) {
      throw new UnauthorizedError('Invalid email or password');
    }

    const storedHashedPassword = rows[0].password;
    const isPasswordValid = await checkPassword(password, storedHashedPassword);

    if (!isPasswordValid) {
      throw new UnauthorizedError('Invalid email or password');
    }

    const token = generateToken(email);
    sendResponse({
      res,
      statusCode: HttpCode.OK,
      message: 'Logged in successfully',
      data: { token },
    });
  })
);

const dbErrorKeywords = ['SQL syntax', 'MySQL'];

function isDbError(message: string): boolean {
  return dbErrorKeywords.some((keyword) => message.includes(keyword));
}

// Error handling middleware
// NOTE: _next is required for express to recognize this as an error handling middleware
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
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
});

app.listen(process.env.PORT, () => {
  console.log(`Server is running on http://${process.env.HOST}:${process.env.PORT}`);
});
