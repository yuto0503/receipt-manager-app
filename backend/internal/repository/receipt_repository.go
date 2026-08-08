package repository

import (
	"database/sql"
	"errors"

	"github.com/yuto-yamazaki/receipt-manager-app/backend/internal/model"
)

var ErrReceiptNotFound = errors.New("レシートが存在しません")

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

// 登録API
func (r *ReceiptRepository) CreateReceipt(receipt model.Receipt) (model.Receipt, error) {
	result, err := r.db.Exec(`
	INSERT INTO receipts (
		store_name,
	  amount,
    purchase_date,
    category,
    memo
	)
		VALUES (?, ?, ?, ?, ?)
	`,
		receipt.StoreName,
		receipt.Amount,
		receipt.PurchaseDate,
		receipt.Category,
		receipt.Memo,
	)
	if err != nil {
		return model.Receipt{}, err
	}

	id, err := result.LastInsertId()
	if err != nil {
		return model.Receipt{}, err
	}

	return r.GetReceiptByID(int(id))
}

// 更新API
func (r *ReceiptRepository) UpdateReceipt(receipt model.Receipt) (model.Receipt, error) {
	result, err := r.db.Exec(`
	UPDATE receipts 
	SET 
		store_name = ?,
		amount = ?, 
		purchase_date = ?, 
		category = ?, 
		memo = ?
	WHERE id = ?
	`,
		receipt.StoreName,
		receipt.Amount,
		receipt.PurchaseDate,
		receipt.Category,
		receipt.Memo,
		receipt.ID,
	)
	if err != nil {
		return model.Receipt{}, err
	}

	affected, err := result.RowsAffected()
	if err != nil {
		return model.Receipt{}, err
	}

	if affected == 0 {
		return model.Receipt{}, ErrReceiptNotFound
	}

	return r.GetReceiptByID(receipt.ID)
}
