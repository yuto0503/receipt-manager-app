-- Remove AUTO_INCREMENT before converting the column back to text.
ALTER TABLE receipts
    MODIFY COLUMN id INT NOT NULL;

ALTER TABLE receipts
    MODIFY COLUMN id VARCHAR(36) NOT NULL;
