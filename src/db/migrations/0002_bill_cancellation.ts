export const sql = `
ALTER TABLE bills ADD COLUMN cancelled_at TEXT;
ALTER TABLE bills ADD COLUMN cancel_reason TEXT;
`;
