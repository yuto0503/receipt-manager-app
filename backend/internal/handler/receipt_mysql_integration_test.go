package handler_test

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"reflect"
	"sort"
	"strings"
	"testing"
	"time"

	"github.com/go-sql-driver/mysql"
	"github.com/labstack/echo/v4"
	"github.com/yuto-yamazaki/receipt-manager-app/backend/internal/handler"
	"github.com/yuto-yamazaki/receipt-manager-app/backend/internal/model"
	"github.com/yuto-yamazaki/receipt-manager-app/backend/internal/repository"
	"github.com/yuto-yamazaki/receipt-manager-app/backend/internal/router"
	"github.com/yuto-yamazaki/receipt-manager-app/backend/internal/service"
)

// Opt in with RECEIPT_TEST_MYSQL_DSN. A connection-local temporary table shadows
// receipts, so existing application rows are never modified. Do not parallelize:
// all SQL must use the single connection that owns the temporary table.
func TestReceiptMySQLIntegration(t *testing.T) {
	dsn := os.Getenv("RECEIPT_TEST_MYSQL_DSN")
	if dsn == "" {
		t.Skip("set RECEIPT_TEST_MYSQL_DSN to run real MySQL verification")
	}
	cfg, err := mysql.ParseDSN(dsn)
	if err != nil {
		t.Fatal("invalid test DSN")
	}
	cfg.ParseTime = true
	cfg.Timeout = 5 * time.Second
	cfg.ReadTimeout = 5 * time.Second
	cfg.WriteTimeout = 5 * time.Second
	db, err := sql.Open("mysql", cfg.FormatDSN())
	if err != nil {
		t.Fatal("cannot open test database")
	}
	defer db.Close()
	db.SetMaxOpenConns(1)
	db.SetMaxIdleConns(1)
	if err := db.Ping(); err != nil {
		t.Fatalf("MySQL connection failed: %v", err)
	}
	paths, err := filepath.Glob("../../migrations/*.up.sql")
	if err != nil || len(paths) == 0 {
		t.Fatal("migrations not found")
	}
	for i, path := range paths {
		migration, err := os.ReadFile(path)
		if err != nil {
			t.Fatal(err)
		}
		statement := string(migration)
		if i == 0 {
			if !strings.Contains(statement, "CREATE TABLE receipts") {
				t.Fatal("expected receipts migration")
			}
			statement = strings.Replace(statement, "CREATE TABLE receipts", "CREATE TEMPORARY TABLE receipts", 1)
		}
		if _, err := db.Exec(statement); err != nil {
			t.Fatalf("migration %s: %v", path, err)
		}
	}
	repo := repository.NewReceiptRepository(db)
	e := echo.New()
	router.SetupRouter(e, handler.NewReceiptHandler(service.NewReceiptService(repo)))
	payload := func() map[string]any {
		return map[string]any{
			"store_name": "検証店舗", "price": 100, "purchase_date": "2026-09-21T00:00:00Z", "category": "食費", "memo": "補足\n２行目",
		}
	}
	encode := func(p map[string]any) string {
		b, err := json.Marshal(p)
		if err != nil {
			t.Fatal(err)
		}
		return string(b)
	}
	request := func(method, body, contentType string, id int) *httptest.ResponseRecorder {
		path := "/receipts"
		if method == http.MethodPut {
			path += fmt.Sprintf("/%d", id)
		}
		req := httptest.NewRequest(method, path, strings.NewReader(body))
		if contentType != "" {
			req.Header.Set(echo.HeaderContentType, contentType)
		}
		rec := httptest.NewRecorder()
		e.ServeHTTP(rec, req)
		return rec
	}
	snapshot := func() []model.Receipt {
		rows, err := repo.GetReceipts()
		if err != nil {
			t.Fatal(err)
		}
		sort.Slice(rows, func(i, j int) bool { return rows[i].ID < rows[j].ID })
		return rows
	}
	successful := func(method string, p map[string]any, id int) model.Receipt {
		t.Helper()
		before := snapshot()
		rec := request(method, encode(p), "application/json; charset=utf-8", id)
		want := http.StatusCreated
		if method == http.MethodPut {
			want = http.StatusOK
		}
		if rec.Code != want {
			t.Fatalf("%s: status=%d body=%s", method, rec.Code, rec.Body.String())
		}
		var response model.Receipt
		if err := json.Unmarshal(rec.Body.Bytes(), &response); err != nil {
			t.Fatal(err)
		}
		stored, err := repo.GetReceiptByID(response.ID)
		if err != nil {
			t.Fatal(err)
		}
		if !reflect.DeepEqual(response, stored) {
			t.Fatal("API response differs from stored row")
		}
		memo, _ := p["memo"].(string)
		if stored.ID <= 0 || stored.StoreName != p["store_name"] || stored.Price != p["price"] || stored.Category != p["category"] || stored.Memo != memo || stored.PurchaseDate.Format("2006-01-02") != p["purchase_date"].(string)[:10] || stored.CreatedAt.IsZero() || stored.UpdatedAt.IsZero() {
			t.Fatalf("unexpected stored row: %+v", stored)
		}
		after := snapshot()
		delta := 1
		if method == http.MethodPut {
			delta = 0
			if stored.ID != id {
				t.Fatal("wrong update target")
			}
		}
		if len(after) != len(before)+delta {
			t.Fatal("unexpected row count")
		}
		for _, old := range before {
			current, err := repo.GetReceiptByID(old.ID)
			if err != nil {
				t.Fatal(err)
			}
			if method == http.MethodPut && old.ID == id {
				if !current.CreatedAt.Equal(old.CreatedAt) {
					t.Fatal("created_at changed")
				}
			} else if !reflect.DeepEqual(old, current) {
				t.Fatal("unrelated row changed")
			}
		}
		return stored
	}
	// Keep a sentinel row to detect accidental changes to unrelated receipts.
	successful(http.MethodPost, payload(), 0)
	var target model.Receipt
	for _, tc := range []struct {
		name string
		edit func(map[string]any)
	}{
		{"ordinary", func(p map[string]any) {}},
		{"zero_and_no_memo", func(p map[string]any) { p["price"] = 0; delete(p, "memo") }},
		{"maximums", func(p map[string]any) {
			p["price"] = 2147483647
			p["store_name"] = strings.Repeat("店", 255)
			p["category"] = strings.Repeat("😀", 100)
			p["memo"] = strings.Repeat("あ", 2000)
		}},
		{"null_memo", func(p map[string]any) { p["memo"] = nil }},
		{"whitespace_preserved", func(p map[string]any) {
			p["store_name"] = " 店舗　"
			p["category"] = " 食費　"
			p["memo"] = " \t\n　"
		}},
	} {
		t.Run("valid/"+tc.name, func(t *testing.T) {
			p := payload()
			tc.edit(p)
			target = successful(http.MethodPost, p, 0)
			p["id"] = target.ID
			p["store_name"] = "更新前"
			successful(http.MethodPut, p, target.ID)
			tc.edit(p)
			if tc.name != "maximums" && tc.name != "whitespace_preserved" {
				p["store_name"] = "更新後"
			}
			target = successful(http.MethodPut, p, target.ID)
		})
	}
	type invalidCase struct{ name, body, contentType string }
	var cases []invalidCase
	for _, field := range []string{"store_name", "price", "purchase_date", "category", "memo"} {
		values := []any{true, []any{}, map[string]any{}}
		if field != "memo" {
			values = append(values, nil)
		}
		switch field {
		case "store_name":
			values = append(values, "", " \t\n　", strings.Repeat("店", 256), 123)
		case "category":
			values = append(values, "", " \t\n　", strings.Repeat("類", 101), 123)
		case "memo":
			values = append(values, strings.Repeat("あ", 2001), 123)
		case "price":
			values = append(values, -1, 2147483648, 1.5, "100")
		case "purchase_date":
			values = append(values, "", " ", "2026-02-29T00:00:00Z", "2026-09-21", "2026-09-21T00:00:00", "0999-01-01T00:00:00Z", 123)
		}
		for i, v := range values {
			p := payload()
			p["id"] = target.ID
			p[field] = v
			cases = append(cases, invalidCase{fmt.Sprintf("%s/%d", field, i), encode(p), echo.MIMEApplicationJSON})
		}
		if field != "memo" {
			p := payload()
			p["id"] = target.ID
			delete(p, field)
			cases = append(cases, invalidCase{field + "/omitted", encode(p), echo.MIMEApplicationJSON})
		}
	}
	for i, body := range []string{"", " \n\t", `{"price":`, `{"price":1,}`, "null", "[]", `"text"`, "123", "true", encode(payload()) + " {}", encode(payload()) + " xyz"} {
		cases = append(cases, invalidCase{fmt.Sprintf("body/%d", i), body, echo.MIMEApplicationJSON})
	}
	for _, ct := range []string{"", "text/plain", "application/json; charset"} {
		cases = append(cases, invalidCase{"content_type/" + ct, encode(payload()), ct})
	}
	for _, method := range []string{http.MethodPost, http.MethodPut} {
		for _, tc := range cases {
			t.Run("invalid/"+method+"/"+tc.name, func(t *testing.T) {
				before := snapshot()
				rec := request(method, tc.body, tc.contentType, target.ID)
				if rec.Code != http.StatusBadRequest {
					t.Fatalf("status=%d body=%s", rec.Code, rec.Body.String())
				}
				var response map[string]string
				if err := json.Unmarshal(rec.Body.Bytes(), &response); err != nil || response["message"] == "" {
					t.Fatalf("missing error message: %s", rec.Body.String())
				}
				if !reflect.DeepEqual(before, snapshot()) {
					t.Fatal("invalid input changed DB rows or timestamps")
				}
			})
		}
	}
}
