package handler

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	_ "github.com/go-sql-driver/mysql"
	"github.com/labstack/echo/v4"
	"github.com/yuto-yamazaki/receipt-manager-app/backend/internal/repository"
	"github.com/yuto-yamazaki/receipt-manager-app/backend/internal/service"
)

func TestCreateReceiptDatabaseFailure(t *testing.T) {
	// Close a lazily opened pool to force a real database/sql error without
	// connecting to or changing an existing database.
	db, err := sql.Open("mysql", "")
	if err != nil {
		t.Fatal(err)
	}
	if err := db.Close(); err != nil {
		t.Fatal(err)
	}
	h := NewReceiptHandler(service.NewReceiptService(repository.NewReceiptRepository(db)))
	e := echo.New()
	e.POST("/receipts", h.CreateReceipt)
	for _, tc := range []struct {
		name   string
		body   string
		status int
	}{
		{"valid input with unavailable database", mustJSON(t, validReceiptPayload()), http.StatusInternalServerError},
		{"malformed JSON with unavailable database", `{"price":`, http.StatusBadRequest},
		{"wrong type with unavailable database", `{"price":"abc"}`, http.StatusBadRequest},
	} {
		t.Run(tc.name, func(t *testing.T) {
			req := httptest.NewRequest(http.MethodPost, "/receipts", strings.NewReader(tc.body))
			req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
			rec := httptest.NewRecorder()
			e.ServeHTTP(rec, req)
			if rec.Code != tc.status {
				t.Fatalf("status=%d, want=%d body=%s", rec.Code, tc.status, rec.Body.String())
			}
			var response map[string]string
			if err := json.Unmarshal(rec.Body.Bytes(), &response); err != nil {
				t.Fatal(err)
			}
			if response["message"] == "" {
				t.Fatal("missing error message")
			}
			if tc.status == http.StatusInternalServerError && response["message"] != "レシートの登録に失敗しました。" {
				t.Fatalf("unexpected server error response: %s", rec.Body.String())
			}
		})
	}
}
