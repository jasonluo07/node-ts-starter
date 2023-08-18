import { Router } from 'express';
import _ from 'lodash';
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
  category: z
    .enum([
      'Electronics',
      'Books',
      'Home Decor',
      'Clothing',
      'Food & Beverages',
      'Health & Beauty',
      'Sports & Leisure',
      'Toys',
      'Handicrafts',
      'Office Supplies',
    ])
    .optional(),
  search: z.string().optional(),
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
  sortBy: z.enum(['id', 'name', 'original_price', 'discount_price']).optional().default('id'),
  order: z.enum(['asc', 'desc']).optional().default('desc'),
});

// GET /products?category=&search=&page=1&limit=10&sort_by=id&order=desc
router.get(
  '/',
  catchAsyncError(async (req, res) => {
    // Convert snake_case keys in req.query to camelCase
    const plainQuery = req.query;
    const camelCasedQuery = _.mapKeys(plainQuery, (_value, key) => _.camelCase(key));

    // Validate the query parameters using the zod schema
    const validationResult = productsQuerySchema.safeParse(camelCasedQuery);
    if (!validationResult.success) throw validationResult.error;

    const { category, search, page, limit, sortBy, order } = validationResult.data;

    // Calculate the offset for SQL query based on page and limit
    const offset = (page - 1) * limit;

    // Fetch the products based on the provided page and limit
    let productsQuery = `
      SELECT
        p.id, p.name, p.original_price, p.discount_price, p.description,
        c.name AS category_name
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
    `;
    const productsWhereClauses = [];
    if (category) {
      productsWhereClauses.push(`c.name = '${category}'`);
    }
    if (search) {
      productsWhereClauses.push(`p.name LIKE '%${search}%'`);
    }
    if (productsWhereClauses.length > 0) {
      productsQuery += ' WHERE ' + productsWhereClauses.join(' AND ');
    }
    productsQuery += `
      ORDER BY ${sortBy} ${order.toUpperCase()}
      LIMIT ? OFFSET ?;
    `;

    const [productsResult] = await pool.execute<RowDataPacket[]>(productsQuery, [limit.toString(), offset.toString()]);

    // Fetch the total count of products
    let countQuery = 'SELECT COUNT(*) AS total FROM products p LEFT JOIN categories c ON p.category_id = c.id';
    const countWhereClauses = [];
    if (category) {
      countWhereClauses.push(`c.name = '${category}'`);
    }
    if (search) {
      countWhereClauses.push(`p.name LIKE '%${search}%'`);
    }
    if (countWhereClauses.length > 0) {
      countQuery += ' WHERE ' + countWhereClauses.join(' AND ');
    }

    const [countResult] = await pool.execute<RowDataPacket[]>(countQuery);

    const products = productsResult as Product[];

    // Construct the pagination object with relevant details
    const pagination = {
      currentItems: products.length,
      totalItems: countResult[0].total as number,
      currentPage: page,
      itemsPerPage: limit,
      // NOTE: get syntax binds an object property to a function that will be called when that property is looked up.
      get totalPages() {
        return Math.ceil(this.totalItems / limit);
      },
    };

    // Send the response with products and pagination details
    sendResponse({
      res,
      statusCode: HttpCode.OK,
      message: 'Products retrieved successfully',
      data: {
        products,
        pagination,
      },
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
