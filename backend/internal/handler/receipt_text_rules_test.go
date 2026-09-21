package handler

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/labstack/echo/v4"
)

func TestReceiptTextTypeRejection(t *testing.T) {
	h := NewReceiptHandler(nil) // 不正な入力がService/DBへ到達するとテストが失敗する。
	for _, method := range []string{http.MethodPost, http.MethodPut} {
		for _, field := range []struct{ key, label string }{{"store_name", "店名"}, {"category", "カテゴリ"}, {"memo", "メモ"}} {
			for _, value := range []any{123, true, []string{}, map[string]string{}} {
				t.Run(method+"/"+field.key+"/"+mustJSON(t, value), func(t *testing.T) {
					payload := validReceiptPayload()
					payload[field.key] = value
					assertReceiptBadRequest(t, h, method, payload, field.label+"は文字列で入力してください。")
				})
			}
		}
	}
}

func validReceiptPayload() map[string]any {
	return map[string]any{"store_name": "店舗", "price": 100, "purchase_date": "2026-09-21T00:00:00Z", "category": "食費", "memo": "補足"}
}

func mustJSON(t *testing.T, value any) string {
	t.Helper()
	body, err := json.Marshal(value)
	if err != nil {
		t.Fatal(err)
	}
	return string(body)
}

func assertReceiptBadRequest(t *testing.T, h *ReceiptHandler, method string, payload map[string]any, message string) {
	t.Helper()
	req := httptest.NewRequest(method, "/receipts/1", strings.NewReader(mustJSON(t, payload)))
	req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	rec := httptest.NewRecorder()
	c := echo.New().NewContext(req, rec)
	var err error
	if method == http.MethodPost {
		err = h.CreateReceipt(c)
	} else {
		err = h.UpdateReceipt(c)
	}
	if err != nil {
		t.Fatal(err)
	}
	var response map[string]string
	if err := json.Unmarshal(rec.Body.Bytes(), &response); err != nil {
		t.Fatal(err)
	}
	if rec.Code != http.StatusBadRequest || response["message"] != message {
		t.Fatalf("status=%d body=%s", rec.Code, rec.Body.String())
	}
}

func TestReceiptRequiredCategory(t *testing.T) {
	h := NewReceiptHandler(nil)
	for _, method := range []string{http.MethodPost, http.MethodPut} {
		for _, value := range []any{nil, "", " ", "　", "\t\r\n", " \t　\n"} {
			t.Run(method+"/"+mustJSON(t, value), func(t *testing.T) {
				payload := validReceiptPayload()
				payload["category"] = value
				assertReceiptBadRequest(t, h, method, payload, "カテゴリを入力してください。空白のみの入力はできません。")
			})
		}
		t.Run(method+"/omitted", func(t *testing.T) {
			payload := validReceiptPayload()
			delete(payload, "category")
			assertReceiptBadRequest(t, h, method, payload, "カテゴリを入力してください。空白のみの入力はできません。")
		})
	}
}

func TestBindReceiptCategoryAndMemo(t *testing.T) {
	for _, method := range []string{http.MethodPost, http.MethodPut} {
		for _, tc := range []struct {
			name     string
			category string
			memo     any
			omitMemo bool
			wantMemo string
		}{
			{"memo omitted", "食費", nil, true, ""},
			{"memo null", "食費", nil, false, ""},
			{"memo empty", "食費", "", false, ""},
			{"whitespace preserved", " 食費　", " \t　\n", false, " \t　\n"},
			{"free category and multiline", "独自カテゴリ", "補足\n次の行", false, "補足\n次の行"},
			{"unicode boundaries", strings.Repeat("😀", 100), strings.Repeat("あ", 2000), false, strings.Repeat("あ", 2000)},
		} {
			t.Run(method+"/"+tc.name, func(t *testing.T) {
				payload := validReceiptPayload()
				payload["category"] = tc.category
				payload["memo"] = tc.memo
				if tc.omitMemo {
					delete(payload, "memo")
				}
				req := httptest.NewRequest(method, "/receipts/1", strings.NewReader(mustJSON(t, payload)))
				req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
				r, err := bindReceipt(echo.New().NewContext(req, httptest.NewRecorder()))
				if err != nil {
					t.Fatal(err)
				}
				if r.Category != tc.category || r.Memo != tc.wantMemo {
					t.Fatalf("unexpected receipt: %+v", r)
				}
			})
		}
	}
}
