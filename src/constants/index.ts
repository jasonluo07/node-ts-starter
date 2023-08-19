export const SALT_ROUNDS = 10;

export enum HttpCode {
  OK = 200,
  CREATED = 201,
  NO_CONTENT = 204,
  BAD_REQUEST = 400,
  UNAUTHORIZED = 401,
  NOT_FOUND = 404,
  INTERNAL_SERVER_ERROR = 500,
}

export enum ProductCategory {
  Electronics = 'Electronics',
  Books = 'Books',
  HomeDecor = 'Home Decor',
  Clothing = 'Clothing',
  FoodAndBeverages = 'Food & Beverages',
  HealthAndBeauty = 'Health & Beauty',
  SportsAndLeisure = 'Sports & Leisure',
  Toys = 'Toys',
  Handicrafts = 'Handicrafts',
  OfficeSupplies = 'Office Supplies',
}
