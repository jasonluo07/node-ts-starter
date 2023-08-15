import './config';

import type { Request, Response } from 'express';
import express from 'express';
import type { ConnectionOptions, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import mysql from 'mysql2/promise';

import { checkPassword, generateToken } from './utils';

const app = express();

app.use(express.json());

const access: ConnectionOptions = {
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
};

const pool = mysql.createPool(access);

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
  price: number;
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

app.get('/products', async (_req: Request, res: Response) => {
  const [rows] = await pool.execute<RowDataPacket[]>('SELECT id, name, price, description FROM products');

  const products = rows as Product[];

  sendResponse({
    res,
    statusCode: HttpCode.OK,
    message: 'Products retrieved successfully',
    data: products,
  });
});

app.get('/products/:productId', async (req: Request, res: Response) => {
  const { productId } = req.params;

  const [rows] = await pool.execute<RowDataPacket[]>('SELECT id, name, price, description FROM products WHERE id = ?', [
    productId,
  ]);

  if (rows.length === 0) {
    sendResponse({
      res,
      statusCode: HttpCode.NOT_FOUND,
      message: 'Product not found',
    });
    return;
  }

  const product = rows[0] as Product;

  sendResponse({
    res,
    statusCode: HttpCode.OK,
    message: 'Product retrieved successfully',
    data: product,
  });
});

app.post('/products', async (req: Request, res: Response) => {
  const { name, price }: Omit<Product, 'id'> = req.body;

  const [result] = await pool.execute<ResultSetHeader>('INSERT INTO products (name, price) VALUES (?, ?)', [
    name,
    price,
  ]);

  if (result.affectedRows === 0) {
    sendResponse({
      res,
      statusCode: HttpCode.INTERNAL_SERVER_ERROR,
      message: 'Product not created',
    });
  } else {
    sendResponse({
      res,
      statusCode: HttpCode.CREATED,
      message: 'Product created',
    });
  }
});

app.put('/products/:productId', async (req: Request, res: Response) => {
  const { productId } = req.params;
  const { name, price, description }: Omit<Product, 'id'> = req.body;

  const [result] = await pool.execute<ResultSetHeader>(
    'UPDATE products SET name = ?, price = ?, description = ? WHERE id = ?',
    [name, price, description, productId]
  );

  if (result.affectedRows === 0) {
    sendResponse({
      res,
      statusCode: HttpCode.NOT_FOUND,
      message: 'Product not found',
    });
  } else {
    sendResponse({
      res,
      statusCode: HttpCode.OK,
      message: 'Product updated',
    });
  }
});

app.delete('/products/:productId', async (req: Request, res: Response) => {
  const { productId } = req.params;

  const [result] = await pool.execute<ResultSetHeader>('DELETE FROM products WHERE id = ?', [productId]);

  if (result.affectedRows === 0) {
    sendResponse({
      res,
      statusCode: HttpCode.NOT_FOUND,
      message: 'Product not found',
    });
  } else {
    sendResponse({
      res,
      statusCode: HttpCode.OK,
      message: 'Product deleted',
    });
  }
});

app.post('/auth/signin', async (req: Request, res: Response) => {
  const { email, password } = req.body;

  const [rows] = await pool.execute<RowDataPacket[]>('SELECT password FROM users WHERE email = ?', [email]);

  if (rows.length === 0) {
    sendResponse({
      res,
      statusCode: HttpCode.UNAUTHORIZED,
      message: 'Invalid email or password',
    });
    return;
  }

  const storedHashedPassword = rows[0].password;
  const isPasswordValid = await checkPassword(password, storedHashedPassword);

  if (!isPasswordValid) {
    sendResponse({
      res,
      statusCode: HttpCode.UNAUTHORIZED,
      message: 'Invalid email or password',
    });
    return;
  }

  const token = generateToken(email);
  sendResponse({
    res,
    statusCode: HttpCode.OK,
    message: 'Logged in successfully',
    data: { token },
  });
});

app.listen(process.env.PORT, () => {
  console.log(`Server is running on http://${process.env.HOST}:${process.env.PORT}`);
});
