DELETE FROM products;

INSERT OR REPLACE INTO products
  (id, name, subtitle, category, roast, notes, price, weight, accent, image, badge, active, sort_order)
VALUES
  ('doare-ground-coffee', 'Doare Coffee', 'Cà phê xay Việt Nam', 'ground', 'Rang vừa đậm', '["Thơm đậm","Cân bằng","Hậu vị êm"]', 185000, '250g', '#c9e5f2', 'assets/images/products/doare-pack-02.webp', 'Sản phẩm chính', 1, 1);
