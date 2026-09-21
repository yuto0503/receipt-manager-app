package model

import (
	"errors"
	"fmt"
	"strings"
	"unicode/utf8"
)

const (
	StoreNameMaxLength = 255
	CategoryMaxLength  = 100
	MemoMaxLength      = 2000
	PriceMax           = 2147483647 // MySQLの符号付きINT型の最大値。
)

// Validate は領収書の登録・更新に共通する入力ルールを検証する。
func (r Receipt) Validate() error {
	if strings.TrimSpace(r.StoreName) == "" {
		return errors.New("店名を入力してください。空白のみの入力はできません。")
	}
	if r.Price < 0 || r.Price > PriceMax {
		return fmt.Errorf("金額は0円以上%d円以下の整数で入力してください。", PriceMax)
	}
	if r.PurchaseDate.IsZero() {
		return errors.New("購入日を指定してください。")
	}
	if r.PurchaseDate.Year() < 1000 || r.PurchaseDate.Year() > 9999 {
		return errors.New("購入日は1000年から9999年の範囲で入力してください。")
	}
	return r.ValidateTextLengths()
}

// ValidateTextLengths はUnicodeコードポイント数で文字数を数え、各項目の上限を検証する。
func (r Receipt) ValidateTextLengths() error {
	for _, field := range []struct {
		name  string
		value string
		limit int
	}{
		{"店名", r.StoreName, StoreNameMaxLength},
		{"カテゴリ", r.Category, CategoryMaxLength},
		{"メモ", r.Memo, MemoMaxLength},
	} {
		if utf8.RuneCountInString(field.value) > field.limit {
			return fmt.Errorf("%sは%d文字以内で入力してください。", field.name, field.limit)
		}
	}
	return nil
}
