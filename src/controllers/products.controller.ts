import type { Response } from 'express';
import _ from 'lodash';
import type { ResultSetHeader, RowDataPacket } from 'mysql2';
import z from 'zod';

import { HttpCode, ProductCategory } from '@/constants';
import { DatabaseError, NotFoundError } from '@/constants/errors';
import pool from '@/databases';
import type { AuthenticatedRequest, Product, ProductDto } from '@/types';
import { sendResponse } from '@/utils';

const productsQuerySchema = z
  .object({
    category: z.nativeEnum(ProductCategory).nullable().default(null),
    priceMin: z
      .string()
      .regex(/^\d+$/, {
        message: 'Minium price must be a non-negative integer',
      })
      .nullable()
      .default(null),
    priceMax: z
      .string()
      .regex(/^[1-9]\d*$/, { message: 'Maximum price must be a positive integer' })
      .nullable()
      .default(null),
    search: z.string().nullable().default(null),
    page: z
      .string()
      .regex(/^[1-9]\d*$/, {
        message: 'Page must be a positive integer',
      })
      .default('1')
      .transform(Number),
    limit: z
      .string()
      .regex(/^[1-9]\d*$/, {
        message: 'Limit must be a positive integer',
      })
      .default('10')
      .transform(Number)
      .refine((value) => value <= 100, {
        message: 'Limit must be less than or equal to 100',
      }),
    sortBy: z.enum(['id', 'name', 'original_price', 'discount_price']).nullable().default(null),
    order: z
      .enum(['desc', 'asc'])
      .nullable()
      .default(null)
      .transform((value) => {
        if (value === 'desc') return 'DESC';
        if (value === 'asc') return 'ASC';
        return null;
      }),
  })
  .refine(
    (data) => {
      if (!data.priceMin || !data.priceMax) return true;
      return Number(data.priceMin) < Number(data.priceMax);
    },
    {
      message: 'Minimum price must be less than maximum price',
    }
  );

// http://localhost:9527/products?category=electronics&priceMin=1000&priceMax=5000&search=apple&page=1&limit=10&sort_by=id&order=desc
export const getProducts = async (req: AuthenticatedRequest, res: Response) => {
  // Convert snake_case keys in req.query to camelCase
  const plainQuery = req.query;
  const camelCasedQuery = _.mapKeys(plainQuery, (_value, key) => _.camelCase(key));

  // Validate the query parameters using Zod schema
  const validationResult = productsQuerySchema.safeParse(camelCasedQuery);
  if (!validationResult.success) throw validationResult.error;

  // Extract the validated query parameters using destructuring
  const params = Object.values(validationResult.data);

  // Call the stored procedure
  const result = await pool.execute<RowDataPacket[]>('CALL GetProducts(?, ?, ?, ?, ?, ?, ?, ?)', params);

  // Extract the products and total record count from the result
  const products: Product[] = result[0][0].map((row: ProductDto) => ({
    id: row.id,
    name: row.name,
    originalPrice: Number(row.original_price),
    discountPrice: Number(row.discount_price),
    description: row.description,
    categoryName: row.category_name,
  }));
  const totalItems = result[0][1][0].TotalRecord as number;

  // Construct the pagination object with relevant details
  const { page, limit } = validationResult.data;
  const pagination = {
    currentItems: products.length,
    totalItems,
    currentPage: page,
    itemsPerPage: limit,
    // NOTE: get syntax binds an object property to a function that will be called when that property is looked up.
    get totalPages() {
      return Math.ceil(this.totalItems / this.itemsPerPage);
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
};

const productQuerySchema = z.object({
  productId: z
    .string()
    .regex(/^[1-9]\d*$/)
    .transform(Number),
});

export const getProductById = async (req: AuthenticatedRequest, res: Response) => {
  const validationResult = productQuerySchema.safeParse(req.params);
  if (!validationResult.success) throw validationResult.error;
  const { productId } = validationResult.data;

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
    data: { product },
  });
};

const createProductSchema = z
  .object({
    name: z.string().min(1).max(255),
    categoryId: z.number().int().positive(),
    originalPrice: z.number().positive().min(100),
    discountPrice: z.number().positive().min(100),
  })
  .refine((data) => data.discountPrice < data.originalPrice);

export const createProduct = async (req: AuthenticatedRequest, res: Response) => {
  const validationResult = createProductSchema.safeParse(req.body);
  if (!validationResult.success) {
    throw validationResult.error;
  }

  const { name, categoryId, originalPrice, discountPrice } = validationResult.data;

  const [result] = await pool.execute<ResultSetHeader>(
    'INSERT INTO products (name, original_price, discount_price, category_id) VALUES (?, ?, ?, ?)',
    [name, originalPrice, discountPrice, categoryId]
  );
  const { affectedRows, insertId } = result;

  if (affectedRows === 0) {
    throw new DatabaseError('Product not created');
  }

  sendResponse({
    res,
    statusCode: HttpCode.CREATED,
    message: 'Product created',
    data: { productId: insertId },
  });
};

const updateProductSchema = z.object({
  name: z.string().min(1).max(255),
  original_price: z.number().positive().min(100),
  discount_price: z.number().positive().min(100),
  description: z.string().default(''),
});

export const updateProduct = async (req: AuthenticatedRequest, res: Response) => {
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
};

export const patchProduct = async (req: AuthenticatedRequest, res: Response) => {
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
};

export const deleteProduct = async (req: AuthenticatedRequest, res: Response) => {
  const { productId } = req.params;

  const [result] = await pool.execute<ResultSetHeader>('DELETE FROM products WHERE id = ?', [productId]);
  const { affectedRows } = result;

  if (affectedRows === 0) {
    throw new NotFoundError('Product not found');
  }

  sendResponse({
    res,
    statusCode: HttpCode.NO_CONTENT,
  });
};
