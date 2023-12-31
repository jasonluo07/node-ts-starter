import { ResultSetHeader } from 'mysql2';
import type { Response } from 'supertest';
import request from 'supertest';

import { app, server } from '@/app';
import { HttpCode } from '@/constants';
import pool, { disconnectDatabase } from '@/databases';

const baseURL = '/products';

describe('Product Routes', () => {
  afterAll(async () => {
    await disconnectDatabase();
    server.close();
  });

  describe('GET /products', () => {
    const testProductResponse = (response: Response, expectedStatusCode: HttpCode) => {
      expect(response.status).toBe(expectedStatusCode);
      expect(response.body.data).toHaveProperty('products');
      expect(response.body.data).toHaveProperty('pagination');
    };

    describe('Valid Queries', () => {
      it('returns products of a specific category', async () => {
        const response = await request(app).get(`${baseURL}?category=Electronics`);
        testProductResponse(response, HttpCode.OK);
        expect(response.body.data.products[0].categoryName).toBe('Electronics');
      });

      it('returns products within a specific price range', async () => {
        const response = await request(app).get(`${baseURL}?priceMin=100&priceMax=1000`);
        testProductResponse(response, HttpCode.OK);
        expect(response.body.data.products[0].discountPrice).toBeGreaterThanOrEqual(100);
        expect(response.body.data.products[0].discountPrice).toBeLessThanOrEqual(1000);
      });

      it('returns products based on a search query', async () => {
        const response = await request(app).get(`${baseURL}?search=Product`);
        testProductResponse(response, HttpCode.OK);
        expect(response.body.data.products[0].name).toContain('Product');
      });

      it('returns products sorted by discount_price in ascending order', async () => {
        const response = await request(app).get(`${baseURL}?sortBy=discount_price&order=desc`);
        testProductResponse(response, HttpCode.OK);
        expect(response.body.data.products[0].discountPrice).toBeGreaterThanOrEqual(
          response.body.data.products[1].discountPrice
        );
      });

      it('returns correct pagination details', async () => {
        const response = await request(app).get(`${baseURL}?page=2&limit=5`);
        testProductResponse(response, HttpCode.OK);
        expect(response.body.data.pagination.currentPage).toBe(2);
        expect(response.body.data.pagination.itemsPerPage).toBe(5);
      });
    });

    describe('Invalid Queries', () => {
      it('returns 400 for invalid category', async () => {
        const response = await request(app).get(`${baseURL}?category=InvalidCategory`);
        expect(response.status).toBe(HttpCode.BAD_REQUEST);
      });

      it('returns 400 for invalid limit', async () => {
        const response = await request(app).get(`${baseURL}?limit=101`);
        expect(response.status).toBe(HttpCode.BAD_REQUEST);
      });

      it('returns 400 for invalid page', async () => {
        const response = await request(app).get(`${baseURL}?page=0`);
        expect(response.status).toBe(HttpCode.BAD_REQUEST);
      });

      it('returns 400 for invalid price range', async () => {
        const response = await request(app).get(`${baseURL}?priceMin=1000&priceMax=100`);
        expect(response.status).toBe(HttpCode.BAD_REQUEST);
      });
    });
  });

  describe('GET /products/:productId', () => {
    it('returns a product with a valid product id', async () => {
      const productId = 1;
      const response = await request(app).get(`${baseURL}/${productId}`);
      expect(response.status).toBe(HttpCode.OK);
      expect(response.body.data).toHaveProperty('product');
      expect(response.body.data.product.id).toBe(1);
      expect(response.body.data.product.name).toBe('Product 1');
    });

    it('returns 400 for invalid product id', async () => {
      const invalidProductId = 'invalidProductId';
      const response = await request(app).get(`${baseURL}/${invalidProductId}`);
      expect(response.status).toBe(HttpCode.BAD_REQUEST);
    });

    it('returns 404 for non-existent product id', async () => {
      const nonExistentProductId = 9999;
      const response = await request(app).get(`${baseURL}/${nonExistentProductId}`);
      expect(response.status).toBe(HttpCode.NOT_FOUND);
    });
  });

  describe('POST /products', () => {
    it('creates a product with valid data', async () => {
      const productData = {
        name: 'New Product',
        categoryId: 1,
        originalPrice: 1000,
        discountPrice: 900,
      };
      const response = await request(app).post(`${baseURL}`).send(productData);
      expect(response.status).toBe(HttpCode.CREATED);
      expect(response.body.data).toHaveProperty('productId');
      expect(response.body.data.productId).toBeGreaterThan(0);
    });

    it('returns 400 for invalid data', async () => {
      const productData = {
        name: 'New Product',
        categoryId: 1,
        originalPrice: 1000,
        discountPrice: 1100,
      };
      const response = await request(app).post(`${baseURL}`).send(productData);
      expect(response.status).toBe(HttpCode.BAD_REQUEST);
    });
  });

  describe('DELETE /:productId', () => {
    let productId: number;

    // 在測試之前，先插入一個產品到資料庫中
    beforeAll(async () => {
      const [result] = await pool.execute<ResultSetHeader>(
        'INSERT INTO products (name, original_price, discount_price, category_id) VALUES (?, ?, ?, ?)',
        ['Test Product', 1000, 900, 1] // 假設 1 是有效的 category_id
      );
      productId = result.insertId;
    });

    // 測試成功刪除產品的情境
    it('should delete a product successfully', async () => {
      const response = await request(app).delete(`${baseURL}/${productId}`);
      expect(response.status).toBe(HttpCode.NO_CONTENT); // 204 就不要回傳 body 了
    });

    // 測試試圖刪除不存在的產品的情境
    it('should return an error if product does not exist', async () => {
      const nonExistentProductId = 9999; // 假設這是一個不存在的 productId
      const response = await request(app).delete(`${baseURL}/${nonExistentProductId}`);
      expect(response.status).toBe(HttpCode.NOT_FOUND);
      expect(response.body.message).toBe('Product not found');
    });

    // 測試結束後，清除測試資料
    afterAll(async () => {
      await pool.execute('DELETE FROM products WHERE id = ?', [productId]);
    });
  });
});
