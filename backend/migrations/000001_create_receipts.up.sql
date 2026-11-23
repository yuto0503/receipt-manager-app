CREATE TABLE receipts (
    id VARCHAR(36) PRIMARY KEY,
    store_name VARCHAR(255) NOT NULL,
    price INTEGER NOT NULL,
    category VARCHAR(100) NOT NULL,
    purchase_date DATE NOT NULL,
    memo TEXT,
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NOT NULL
);