USE test;

SELECT * FROM orders JOIN orders.user_id ON users.id WHERE users.email = 'user4@ex.com';

SELECT * FROM orders JOIN users ON orders.user_id = users.id WHERE orders.id = 32 AND users.email = 'user4@ex.com';




SELECT COUNT(*) FROM orders GROUP BY user_id ORDER BY COUNT(*);

SELECT * FROm 