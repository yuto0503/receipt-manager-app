package handler

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strconv"
	"strings"
	"testing"

	"github.com/labstack/echo/v4"
)

func TestReceiptPriceRejection(t *testing.T) {
	h := NewReceiptHandler(nil) // Invalid input must never reach the service/DB.
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
