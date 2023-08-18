import type { Response } from 'supertest';
import request from 'supertest';

import { app, server } from '@/app';
import { disconnectDatabase } from '@/databases';
import { HttpCode } from '@/enums';

describe('GET /products', () => {
  const baseURL = '/products';

  afterAll(async () => {
    await disconnectDatabase();
    await new Promise((resolve) => server.close(resolve));
  });

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

    // it('returns 400 for invalid price range', async () => {
    //   const response = await request(app).get(`${baseURL}?priceMin=1000&priceMax=100`);
    //   expect(response.status).toBe(HttpCode.BAD_REQUEST);
    // });
  });
});
