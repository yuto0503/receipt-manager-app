-- Existing IDs must be distinct integers within the INT range before applying.
ALTER TABLE receipts
    MODIFY COLUMN id INT NOT NULL AUTO_INCREMENT;
