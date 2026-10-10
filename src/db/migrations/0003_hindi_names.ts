export const sql = `
ALTER TABLE products ADD COLUMN name_hi TEXT;
ALTER TABLE categories ADD COLUMN name_hi TEXT;
ALTER TABLE subcategories ADD COLUMN name_hi TEXT;
ALTER TABLE parties ADD COLUMN name_hi TEXT;
`;
