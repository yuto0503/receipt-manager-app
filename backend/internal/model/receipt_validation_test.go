package model

import (
	"strings"
	"testing"
	"time"
)

func TestValidateTextLengths(t *testing.T) {
	for _, tc := range []struct {
		name  string
		limit int
		set   func(*Receipt, string)
	}{
		{"store_name", 255, func(r *Receipt, v string) { r.StoreName = v }},
		{"category", 100, func(r *Receipt, v string) { r.Category = v }},
		{"memo", 2000, func(r *Receipt, v string) { r.Memo = v }},
	} {
		t.Run(tc.name, func(t *testing.T) {
			for _, char := range []string{"a", "あ", "😀"} {
				for _, n := range []int{0, tc.limit - 1, tc.limit, tc.limit + 1} {
					var r Receipt
					tc.set(&r, strings.Repeat(char, n))
					if err := r.ValidateTextLengths(); (err != nil) != (n > tc.limit) {
						t.Errorf("char=%s length=%d: unexpected error %v", char, n, err)
					}
				}
			}
		})
	}
}

func TestValidateStoreName(t *testing.T) {
	for _, name := range []string{"", " ", "　", "\t\r\n", " \t　\n"} {
		if err := (Receipt{StoreName: name}).Validate(); err == nil {
			t.Errorf("expected rejection for %q", name)
		}
	}
	for _, name := range []string{"店舗", " 店舗　", "東京 支店"} {
		r := Receipt{StoreName: name, Category: "食費", PurchaseDate: time.Date(2026, 9, 21, 0, 0, 0, 0, time.UTC)}
		if err := r.Validate(); err != nil {
			t.Errorf("unexpected rejection for %q: %v", name, err)
		}
		if r.StoreName != name {
			t.Errorf("store name was modified: %q", r.StoreName)
		}
	}
}

func TestValidateCategory(t *testing.T) {
	for _, category := range []string{"", " ", "　", "\t\r\n", " \t　\n", "食費", " 食費　", strings.Repeat("あ", 100), strings.Repeat("あ", 101)} {
		t.Run(category, func(t *testing.T) {
			r := Receipt{StoreName: "店舗", Category: category, PurchaseDate: time.Date(2026, 9, 21, 0, 0, 0, 0, time.UTC)}
			err := r.Validate()
			want := ""
			if strings.TrimSpace(category) == "" {
				want = "カテゴリを入力してください。空白のみの入力はできません。"
			} else if category == strings.Repeat("あ", 101) {
				want = "カテゴリは100文字以内で入力してください。"
			}
			if want == "" {
				if err != nil {
					t.Fatal(err)
				}
			} else if err == nil || err.Error() != want {
				t.Fatalf("got %v, want %s", err, want)
			}
			if r.Category != category {
				t.Fatal("category was modified")
			}
		})
	}
}
