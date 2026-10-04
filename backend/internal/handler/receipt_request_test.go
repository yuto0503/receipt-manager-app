package handler

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/labstack/echo/v4"
)

func TestReceiptPriceRejection(t *testing.T) {
	h := NewReceiptHandler(nil) // 不正な入力がサービスやDBに到達してはならない。
	for _, method := range []string{http.MethodPost, http.MethodPut} {
		for _, price := range []string{"", "null", "-1", "2147483648", "9223372036854775808", "1.5", `"100"`, "true", "[]", "{}"} {
			t.Run(method+"/"+price, func(t *testing.T) {
				body := `{"store_name":"店舗"`
				if price != "" {
					body += `,"price":` + price
				}
				body += `}`
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
				want := "金額は0円以上2147483647円以下の整数で入力してください。"
				if price == "" || price == "null" {
					want = "金額を指定してください。0円も指定できます。"
				}
				if rec.Code != http.StatusBadRequest || response["message"] != want {
					t.Fatalf("status=%d body=%s", rec.Code, rec.Body.String())
				}
			})
		}
	}
}

func TestBindReceiptValidPrice(t *testing.T) {
	for _, method := range []string{http.MethodPost, http.MethodPut} {
		for _, price := range []int{0, 1, 2147483647} {
			body := `{"id":7,"store_name":"店舗","price":` + strconv.Itoa(price) + `,"category":"食費","memo":"補足","purchase_date":"2026-09-15T00:00:00Z"}`
			req := httptest.NewRequest(method, "/receipts/7", strings.NewReader(body))
			req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
			c := echo.New().NewContext(req, httptest.NewRecorder())
			r, err := bindReceipt(c)
			if err != nil {
				t.Fatal(err)
			}
			if r.Price != price || r.ID != 7 || r.StoreName != "店舗" || r.Category != "食費" || r.Memo != "補足" || r.PurchaseDate.Format("2006-01-02") != "2026-09-15" {
				t.Fatalf("unexpected receipt: %+v", r)
			}
		}
	}
}

func TestReceiptPurchaseDateRejection(t *testing.T) {
	h := NewReceiptHandler(nil) // DBへの到達を禁止して検証する。
	for _, method := range []string{http.MethodPost, http.MethodPut} {
		for _, value := range []string{"", "null", `""`, `" \t　"`, `"2026-09-21"`, `"2026/09/21"`, `"2026-09-21T00:00:00"`, `"2026-02-29T00:00:00Z"`, `"2024-02-30T00:00:00Z"`, `"2026-13-01T00:00:00Z"`, `"2026-09-21T24:00:00Z"`, `"2026-09-21T1:00:00Z"`, `"2026-09-21T00:00:00+24:00"`, `"2026-09-21T00:00:00+09:60"`, `"2026-09-21T00:00:00,123Z"`, `"2026-09-21T00:00:00.1234567890Z"`, `" 2026-09-21T00:00:00Z"`, `"0001-01-01T00:00:00Z"`, `"0999-12-31T00:00:00Z"`, "123", "true", "[]", "{}"} {
			t.Run(method+"/"+value, func(t *testing.T) {
				body := `{"store_name":"店舗","price":100`
				if value != "" {
					body += `,"purchase_date":` + value
				}
				body += `}`
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
				want := purchaseDateFormatMessage
				switch value {
				case "", "null", `""`, `" \t　"`, `"0001-01-01T00:00:00Z"`:
					want = "購入日を指定してください。"
				case `"0999-12-31T00:00:00Z"`:
					want = "購入日は1000年から9999年の範囲で入力してください。"
				}
				if rec.Code != http.StatusBadRequest || response["message"] != want {
					t.Fatalf("status=%d body=%s", rec.Code, rec.Body.String())
				}
			})
		}
	}
}

func TestBindReceiptValidPurchaseDate(t *testing.T) {
	for _, method := range []string{http.MethodPost, http.MethodPut} {
		for _, value := range []string{"2024-02-29T00:00:00Z", "2026-09-21T12:34:56+09:00", "2026-09-21T12:34:56-05:30", "2026-09-21T12:34:56.123456789Z", "1000-01-01T00:00:00Z", "9999-12-31T23:59:59Z"} {
			t.Run(method+"/"+value, func(t *testing.T) {
				body := `{"store_name":"店舗","category":"食費","price":0,"purchase_date":"` + value + `"}`
				req := httptest.NewRequest(method, "/receipts/1", strings.NewReader(body))
				req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
				r, err := bindReceipt(echo.New().NewContext(req, httptest.NewRecorder()))
				if err != nil {
					t.Fatal(err)
				}
				if got := r.PurchaseDate.Format(time.RFC3339Nano); got != value {
					t.Fatalf("got %s, want %s", got, value)
				}
			})
		}
	}
}
