package model

import (
	"fmt"
	"unicode/utf8"
)

const (
	StoreNameMaxLength = 255
	CategoryMaxLength  = 100
	MemoMaxLength      = 2000
)

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
