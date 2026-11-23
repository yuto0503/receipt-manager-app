package router

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/labstack/echo/v4"
	"github.com/yuto-yamazaki/receipt-manager-app/backend/internal/handler"
)

func TestReceiptRoutesRejectInvalidURLID(t *testing.T) {
	e := echo.New()
	// サービスにアクセスする前に、不正なIDを拒否する必要がある。
	SetupRouter(e, handler.NewReceiptHandler(nil))
	for _, method := range []string{http.MethodGet, http.MethodPut, http.MethodDelete} {
		for _, id := range []string{"abc", "0", "-1", "1.5", "999999999999999999999999999999"} {
			t.Run(method+"/"+id, func(t *testing.T) {
				body := `{"id":1,"store_name":"店舗","price":100,"purchase_date":"2026-10-04T00:00:00+09:00","category":"食費"}`
				req := httptest.NewRequest(method, "/receipts/"+id, strings.NewReader(body))
				req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
				rec := httptest.NewRecorder()
				e.ServeHTTP(rec, req)
				if rec.Code != http.StatusBadRequest || !strings.Contains(rec.Body.String(), "IDは1以上の整数で指定してください。") {
					t.Fatalf("status=%d body=%s", rec.Code, rec.Body.String())
				}
			})
		}
	}
}
