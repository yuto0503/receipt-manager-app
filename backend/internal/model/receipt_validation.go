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
)

// Validate checks the shared input rules for creating and updating receipts.
func (r Receipt) Validate() error {
	if strings.TrimSpace(r.StoreName) == "" {
		return errors.New("店名を入力してください。空白のみの入力はできません。")
	}
	return r.ValidateTextLengths()
}

// ValidateTextLengths counts Unicode code points, rather than UTF-8 bytes.
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
