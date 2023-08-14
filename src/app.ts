import './config';

import type { Request, Response } from 'express';
import express from 'express';
import type { ConnectionOptions, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import mysql from 'mysql2/promise';

const app = express();

app.use(express.json());

const access: ConnectionOptions = {
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
};

const pool = mysql.createPool(access);

interface Product {
  id: number;
  name: string;
  price: number;
  description: string;
}

interface ApiResponse<T> {
  status: number;
  message: string;
  data?: T;
}

interface SendResponseParams<T> {
  res: Response;
  status: number;
  message: string;
  data?: T;
}

function sendResponse<T>({ res, status, message, data }: SendResponseParams<T>): void {
  const response: ApiResponse<T> = {
    status,
    message,
    data,
  };
  res.status(status).json(response);
}

app.get('/products', async (_req: Request, res: Response) => {
  const connection = await pool.getConnection();

  const [rows] = await connection.query<RowDataPacket[]>('SELECT id, name, price, description FROM products');
  connection.release();
  const products = rows as Product[];

  sendResponse({
    res,
    status: 200,
    message: 'Products retrieved successfully',
    data: products,
  });
});

app.get('/products/:productId', async (req: Request, res: Response) => {
  const { productId } = req.params;

  const connection = await pool.getConnection();
  const [rows] = await connection.query<RowDataPacket[]>(
    'SELECT id, name, price, description FROM products WHERE id = ?',
    [productId]
  );
  connection.release();

  if (rows.length === 0) {
    sendResponse({
      res,
      status: 404,
      message: 'Product not found',
    });
    return;
  }

  const product = rows[0] as Product;

  sendResponse({
    res,
    status: 200,
    message: 'Product retrieved successfully',
    data: product,
  });
});

app.post('/products', async (req: Request, res: Response) => {
  const { name, price }: Omit<Product, 'id'> = req.body;

  const connection = await pool.getConnection();
  const [result] = await connection.query<ResultSetHeader>('INSERT INTO products (name, price) VALUES (?, ?)', [
    name,
    price,
  ]);
  connection.release();

  if (result.affectedRows === 0) {
    sendResponse({
      res,
      status: 500,
      message: 'Product not created',
    });
  } else {
    sendResponse({
      res,
      status: 201,
      message: 'Product created',
    });
  }
});

app.put('/products/:productId', async (req: Request, res: Response) => {
  const { productId } = req.params;
  const { name, price, description }: Omit<Product, 'id'> = req.body;

  const connection = await pool.getConnection();
  const [result] = await connection.query<ResultSetHeader>(
    'UPDATE products SET name = ?, price = ?, description = ? WHERE id = ?',
    [name, price, description, productId]
  );
  connection.release();

  if (result.affectedRows === 0) {
    sendResponse({
      res,
      status: 404,
      message: 'Product not found',
    });
  } else {
    sendResponse({
      res,
      status: 200,
      message: 'Product updated',
    });
  }
});

app.delete('/products/:productId', async (req: Request, res: Response) => {
  const { productId } = req.params;

  const connection = await pool.getConnection();
  const [result] = await connection.query<ResultSetHeader>('DELETE FROM products WHERE id = ?', [productId]);
  connection.release();

  if (result.affectedRows === 0) {
    sendResponse({
      res,
      status: 404,
      message: 'Product not found',
    });
  } else {
    sendResponse({
      res,
      status: 200,
      message: 'Product deleted',
    });
  }
});

app.listen(process.env.PORT, () => {
  console.log(`Server is running on http://${process.env.HOST}:${process.env.PORT}`);
});
