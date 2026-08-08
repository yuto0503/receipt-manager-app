package model

import "time"

type Receipt struct {
	ID           int       `json:"id"`
	StoreName    string    `json:"store_name"`
	Amount       int       `json:"amount"`
	PurchaseDate time.Time `json:"purchase_date"`
	Category     string    `json:"category"`
	Memo         string    `json:"memo"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
}
