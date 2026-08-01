package repository

import (
	"database/sql"

	"github.com/yuto-yamazaki/receipt-manager-app/backend/internal/model"
)

type ReceiptRepository struct {
	db *sql.DB
}

func NewReceiptRepository(db *sql.DB) *ReceiptRepository {
	return &ReceiptRepository{
		db: db,
	}
}

// 一覧取得
func (r *ReceiptRepository) GetReceipts() ([]model.Receipt, error) {
	rows, err := r.db.Query(`
		SELECT
			id,
			store_name,
			amount,
			purchase_date,
			category,
			memo,
			created_at,
			updated_at
		FROM receipts
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	// ここにデータを追加していく
	var receipts []model.Receipt

	for rows.Next() {
		var receipt model.Receipt

		if err := rows.Scan(
			&receipt.ID,
			&receipt.StoreName,
			&receipt.Amount,
			&receipt.PurchaseDate,
			&receipt.Category,
			&receipt.Memo,
			&receipt.CreatedAt,
			&receipt.UpdatedAt,
		); err != nil {
			return nil, err
		}

		receipts = append(receipts, receipt)
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	return receipts, nil
}

// 1件取得
func (r *ReceiptRepository) GetReceiptByID(id int) (model.Receipt, error) {
	row := r.db.QueryRow(`
		SELECT
			id,
			store_name,
			amount,
			purchase_date,
			category,
			memo,
			created_at,
			updated_at
		FROM receipts
		WHERE id = ?
	`, id)

	var receipt model.Receipt

	if err := row.Scan(
		&receipt.ID,
		&receipt.StoreName,
		&receipt.Amount,
		&receipt.PurchaseDate,
		&receipt.Category,
		&receipt.Memo,
		&receipt.CreatedAt,
		&receipt.UpdatedAt,
	); err != nil {
		return model.Receipt{}, err
	}

	return receipt, nil
}
