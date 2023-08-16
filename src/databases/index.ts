import type { ConnectionOptions } from 'mysql2/promise';
import mysql from 'mysql2/promise';

const access: ConnectionOptions = {
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
};

const pool = mysql.createPool(access);

pool
  .getConnection()
  .then((connection) => {
    console.log('Successfully connected to the database.');
    connection.release(); // TODO: Check if this is necessary
  })
  .catch((error) => {
    console.error('Error connecting to the database:', error);
  });

export default pool;
