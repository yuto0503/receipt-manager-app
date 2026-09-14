package handler

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/labstack/echo/v4"
)

func TestReceiptTextLengthRejection(t *testing.T) {
	// A nil service ensures invalid input is rejected before any DB access.
	h := NewReceiptHandler(nil)
	for _, method := range []string{http.MethodPost, http.MethodPut} {
		for _, tc := range []struct {
			field   string
			length  int
			message string
		}{
			{"store_name", 256, "店名は255文字以内で入力してください。"},
			{"category", 101, "カテゴリは100文字以内で入力してください。"},
			{"memo", 2001, "メモは2000文字以内で入力してください。"},
		} {
			t.Run(method+"/"+tc.field, func(t *testing.T) {
				payload := map[string]any{"store_name": "店舗", "category": "食費", "price": 100, "purchase_date": "2026-09-13T00:00:00Z"}
				payload[tc.field] = strings.Repeat("あ", tc.length)
				body, err := json.Marshal(payload)
				if err != nil {
					t.Fatal(err)
				}
				req := httptest.NewRequest(method, "/receipts/1", strings.NewReader(string(body)))
				req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
				rec := httptest.NewRecorder()
				c := echo.New().NewContext(req, rec)
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
				if rec.Code != http.StatusBadRequest || response["message"] != tc.message {
					t.Fatalf("status=%d body=%s", rec.Code, rec.Body.String())
				}
			})
		}
	}
}

func TestReceiptBlankStoreNameRejection(t *testing.T) {
	// No service is provided: reaching persistence would fail the test.
	h := NewReceiptHandler(nil)
	for _, method := range []string{http.MethodPost, http.MethodPut} {
		for _, body := range []string{
			`{"store_name":""}`, `{"store_name":"   "}`,
			`{"store_name":"　"}`, `{"store_name":"\t\r\n"}`,
			`{"store_name":" \t　\n"}`, `{}`, `{"store_name":null}`,
		} {
			t.Run(method+"/"+body, func(t *testing.T) {
				req := httptest.NewRequest(method, "/receipts/1", strings.NewReader(body))
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
				if rec.Code != http.StatusBadRequest || response["message"] != "店名を入力してください。空白のみの入力はできません。" {
					t.Fatalf("status=%d body=%s", rec.Code, rec.Body.String())
				}
			})
		}
	}
}
