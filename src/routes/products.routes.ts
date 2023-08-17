import { Router } from 'express';
import type { ResultSetHeader, RowDataPacket } from 'mysql2';
import z from 'zod';

import pool from '@/databases';
import { HttpCode } from '@/enums';
import { DatabaseError, NotFoundError } from '@/errors';
import { catchAsyncError } from '@/middlewares';
import type { Product } from '@/types';
import { sendResponse } from '@/utils';

const router = Router();

const productsQuerySchema = z.object({
  page: z
    .string()
    .regex(/^[1-9]\d*$/, {
      message: 'Page must be a positive integer',
    })
    .optional()
    .default('1')
    .transform(Number),
  limit: z
    .string()
    .regex(/^[1-9]\d*$/, {
      message: 'Limit must be a positive integer',
    })
    .optional()
    .default('10')
    .transform(Number)
    .refine((value) => value <= 100, {
      message: 'Limit must be less than 100',
    }),
});

// TODO: /products?page=2&limit=5&sortBy=price&order=desc
router.get(
  '/',
  catchAsyncError(async (req, res) => {
    const validationResult = productsQuerySchema.safeParse(req.query);
    if (!validationResult.success) {
      throw validationResult.error;
    }

    const { page, limit } = validationResult.data;
    const offset = (page - 1) * limit;

    const query = `
      SELECT
        p.id, p.name, p.original_price, p.discount_price, p.description,
        c.name AS category_name
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      LIMIT ? OFFSET ?;
    `;

    // FIXME: Why use toString?
    const [rows] = await pool.execute<RowDataPacket[]>(query, [limit.toString(), offset.toString()]);

    const products = rows as Product[];

    sendResponse({
      res,
      statusCode: HttpCode.OK,
      message: 'Products retrieved successfully',
      data: products,
    });
  })
);

router.get(
  '/:productId',
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

router.post(
  '/',
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
      data: { userId: insertId },
    });
  })
);

const updateProductSchema = z.object({
  name: z.string().min(1).max(255),
  original_price: z.number().positive().min(100),
  discount_price: z.number().positive().min(100),
  description: z.string().default(''),
});

router.put(
  '/:productId',
  catchAsyncError(async (req, res) => {
    const { productId } = req.params;

    const validationResult = updateProductSchema.safeParse(req.body);
    if (!validationResult.success) {
      throw validationResult.error;
    }
    const { name, original_price, discount_price, description } = validationResult.data;

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

router.patch(
  '/:productId',
  catchAsyncError(async (req, res) => {
    const { productId } = req.params;
    const updates = req.body;

    const updateQueries = Object.keys(updates)
      .map((key) => `${key} = ?`)
      .join(', ');
    const updateValues = Object.values(updates);

    const [result] = await pool.execute<ResultSetHeader>(`UPDATE products SET ${updateQueries} WHERE id = ?`, [
      ...updateValues,
      productId,
    ]);
    const { affectedRows } = result;

    if (affectedRows === 0) {
      throw new NotFoundError('Product not found');
    }

    sendResponse({
      res,
      statusCode: HttpCode.OK,
      message: 'Product partially updated',
    });
  })
);

router.delete(
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

export default router;
