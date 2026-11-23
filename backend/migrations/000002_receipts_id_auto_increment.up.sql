-- 適用前に、既存のIDがINT型の範囲内の重複しない整数である必要がある。
ALTER TABLE receipts
    MODIFY COLUMN id INT NOT NULL AUTO_INCREMENT;
