import './config';

import type { Request, Response } from 'express';
import express from 'express';
import type { ConnectionOptions, RowDataPacket } from 'mysql2/promise';
import mysql from 'mysql2/promise';

const app = express();

app.use(express.json());

const access: ConnectionOptions = {
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
};

const connection = mysql.createConnection(access);

interface Product {
  id: number;
  name: string;
  price: number;
  description: string;
}

// Get all products
app.get('/products', async (_req: Request, res: Response) => {
  const [rows] = await (await connection).query<RowDataPacket[]>('SELECT id, name, price, description FROM products');
  const products = rows as Product[];
  res.json(products);
});

// Get a specific product
app.get('/products/:productId', async (req: Request, res: Response) => {
  const [rows] = await (
    await connection
  ).query<RowDataPacket[]>('SELECT id, name, price, description FROM products WHERE id = ?', [req.params.productId]);
  const product = rows[0] as Product;
  res.json(product);
});

// Create a new product
app.post('/products', async (req: Request, res: Response) => {
  const product: Omit<Product, 'id'> = req.body;
  const result = await (
    await connection
  ).query('INSERT INTO products (name, price) VALUES (?, ?)', [product.name, product.price]);
  res.status(201).json({ message: 'Product created', result });
});

// Update a specific product
app.put('/products/:productId', async (req: Request, res: Response) => {
  const product: Omit<Product, 'id'> = req.body;
  const result = await (
    await connection
  ).query('UPDATE products SET name = ?, price = ?, description = ? WHERE id = ?', [
    product.name,
    product.price,
    product.description,
    req.params.productId,
  ]);
  res.json({ message: 'Product updated', result });
});

// Delete a specific product
app.delete('/products/:productId', async (req: Request, res: Response) => {
  const result = await (await connection).query('DELETE FROM products WHERE id = ?', [req.params.productId]);
  res.json({ message: 'Product deleted', result });
});

app.listen(process.env.PORT, () => {
  console.log(`Server is running on http://${process.env.HOST}:${process.env.PORT}`);
});
