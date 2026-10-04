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

// RECEIPT_TEST_MYSQL_DSNを設定すると実行する。接続内だけで有効な一時テーブルで
// receiptsを隠すため、既存のアプリケーションの行は変更されない。並列実行は禁止。
// すべてのSQLで、一時テーブルを所有する単一の接続を使用する必要がある。
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
	// 同一内容のUPDATEが更新件数0になる設定で回帰を検証する。
	cfg.ClientFoundRows = false
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
		if method == http.MethodPut || method == http.MethodDelete || (method == http.MethodGet && id != 0) {
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
	checkList := func(t *testing.T, want []model.Receipt) {
		t.Helper()
		rec := request(http.MethodGet, "", "", 0)
		if rec.Code != http.StatusOK {
			t.Fatalf("status=%d body=%s", rec.Code, rec.Body.String())
		}
		if !strings.HasPrefix(rec.Header().Get(echo.HeaderContentType), echo.MIMEApplicationJSON) {
			t.Fatalf("unexpected Content-Type: %s", rec.Header().Get(echo.HeaderContentType))
		}
		var got []model.Receipt
		if err := json.Unmarshal(rec.Body.Bytes(), &got); err != nil {
			t.Fatal(err)
		}
		if got == nil {
			t.Fatalf("expected JSON array, got %s", rec.Body.String())
		}
		if len(want) == 0 && strings.TrimSpace(rec.Body.String()) != "[]" {
			t.Fatalf("expected [], got %s", rec.Body.String())
		}
		// 一覧の並び順はAPIの契約に含めず、全フィールドと件数を比較する。
		sort.Slice(got, func(i, j int) bool { return got[i].ID < got[j].ID })
		if !reflect.DeepEqual(got, want) {
			t.Fatalf("list mismatch: got=%+v want=%+v", got, want)
		}
	}
	t.Run("list/empty", func(t *testing.T) {
		checkList(t, []model.Receipt{})
	})
	t.Run("crud_lifecycle", func(t *testing.T) {
		p := payload()
		created := successful(http.MethodPost, p, 0)
		checkList(t, []model.Receipt{created})
		checkDetail := func(want model.Receipt) {
			t.Helper()
			rec := request(http.MethodGet, "", "", want.ID)
			if rec.Code != http.StatusOK {
				t.Fatalf("get: status=%d body=%s", rec.Code, rec.Body.String())
			}
			var got model.Receipt
			if err := json.Unmarshal(rec.Body.Bytes(), &got); err != nil {
				t.Fatal(err)
			}
			if !reflect.DeepEqual(got, want) {
				t.Fatalf("detail mismatch: got=%+v want=%+v", got, want)
			}
		}
		checkDetail(created)
		// TIMESTAMPは秒単位の精度のため、内容変更時に更新日時が進むように待機する。
		time.Sleep(1100 * time.Millisecond)
		p["store_name"] = "CRUD更新店舗"
		p["price"] = 789
		p["purchase_date"] = "2026-10-04T00:00:00Z"
		p["category"] = "日用品"
		p["memo"] = "更新後のメモ"
		updated := successful(http.MethodPut, p, created.ID)
		if !updated.CreatedAt.Equal(created.CreatedAt) || !updated.UpdatedAt.After(created.UpdatedAt) {
			t.Fatal("changed update must preserve created_at and advance updated_at")
		}
		checkDetail(updated)
		checkList(t, []model.Receipt{updated})
		rec := request(http.MethodDelete, "", "", created.ID)
		if rec.Code != http.StatusNoContent || rec.Body.Len() != 0 {
			t.Fatalf("delete: status=%d body=%s", rec.Code, rec.Body.String())
		}
		checkList(t, []model.Receipt{})
		rec = request(http.MethodGet, "", "", created.ID)
		if rec.Code != http.StatusNotFound {
			t.Fatalf("get after delete: status=%d body=%s", rec.Code, rec.Body.String())
		}
	})
	// 無関係なレシートへの意図しない変更を検出するため、監視用の行を保持する。
	sentinel := successful(http.MethodPost, payload(), 0)
	t.Run("list/one", func(t *testing.T) {
		checkList(t, []model.Receipt{sentinel})
	})
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
			// 本文にIDが含まれていない場合も、URLで対象を特定する。
			delete(p, "id")
			p["store_name"] = "更新前"
			successful(http.MethodPut, p, target.ID)
			// 本文に異なるIDが指定されても、更新対象を変更してはならない。
			p["id"] = target.ID + 1000
			tc.edit(p)
			if tc.name != "maximums" && tc.name != "whitespace_preserved" {
				p["store_name"] = "更新後"
			}
			target = successful(http.MethodPut, p, target.ID)
		})
	}
	t.Run("list/multiple", func(t *testing.T) {
		want := snapshot()
		if len(want) < 2 {
			t.Fatal("expected multiple test receipts")
		}
		checkList(t, want)
	})
	t.Run("update_outcomes", func(t *testing.T) {
		p := payload()
		created := successful(http.MethodPost, p, 0)
		t.Run("changed", func(t *testing.T) {
			p["store_name"] = "内容変更の検証店舗"
			p["price"] = 456
			successful(http.MethodPut, p, created.ID)
		})
		t.Run("unchanged", func(t *testing.T) {
			before := snapshot()
			successful(http.MethodPut, p, created.ID)
			if !reflect.DeepEqual(before, snapshot()) {
				t.Fatal("identical update changed rows or timestamps")
			}
		})
		t.Run("not_found", func(t *testing.T) {
			before := snapshot()
			rec := request(http.MethodPut, encode(p), echo.MIMEApplicationJSON, created.ID+1000)
			if rec.Code != http.StatusNotFound {
				t.Fatalf("status=%d body=%s", rec.Code, rec.Body.String())
			}
			var response map[string]string
			if err := json.Unmarshal(rec.Body.Bytes(), &response); err != nil || response["message"] != "レシートが存在しません。" {
				t.Fatalf("unexpected error response: %s", rec.Body.String())
			}
			if !reflect.DeepEqual(before, snapshot()) {
				t.Fatal("missing target update changed rows or timestamps")
			}
		})
	})
	t.Run("update_body_id/omitted", func(t *testing.T) {
		p := payload()
		delete(p, "id")
		p["store_name"] = "ID省略で更新した店舗"
		p["price"] = 321
		p["memo"] = "URLのIDで更新"
		// HTTP 200、レスポンスと保存先のID・内容、他の行が不変であることを確認する。
		successful(http.MethodPut, p, target.ID)
	})
	for _, tc := range []struct {
		name string
		id   any
	}{
		{"matching", target.ID},
		{"other_existing_receipt", sentinel.ID},
		{"nonexistent", target.ID + 1000},
		{"zero", 0},
		{"negative", -1},
		{"null", nil},
	} {
		t.Run("update_body_id/"+tc.name, func(t *testing.T) {
			p := payload()
			p["id"] = tc.id
			p["store_name"] = "ID検証/" + tc.name
			// successfulでは、レスポンスのIDと無関係なすべての行も検証する。
			successful(http.MethodPut, p, target.ID)
		})
	}
	t.Run("missing_url_target_with_existing_body_id", func(t *testing.T) {
		before := snapshot()
		p := payload()
		p["id"] = sentinel.ID
		p["store_name"] = "変更されてはいけない店舗"
		rec := request(http.MethodPut, encode(p), echo.MIMEApplicationJSON, target.ID+1000)
		if rec.Code != http.StatusNotFound {
			t.Fatalf("status=%d body=%s", rec.Code, rec.Body.String())
		}
		if !reflect.DeepEqual(before, snapshot()) {
			t.Fatal("body ID redirected update when URL target was missing")
		}
	})
	t.Run("delete_outcomes", func(t *testing.T) {
		created := successful(http.MethodPost, payload(), 0)
		before := snapshot()
		want := make([]model.Receipt, 0, len(before)-1)
		for _, receipt := range before {
			if receipt.ID != created.ID {
				want = append(want, receipt)
			}
		}
		rec := request(http.MethodDelete, "", "", created.ID)
		if rec.Code != http.StatusNoContent || rec.Body.Len() != 0 {
			t.Fatalf("delete: status=%d body=%s", rec.Code, rec.Body.String())
		}
		if !reflect.DeepEqual(snapshot(), want) {
			t.Fatal("delete did not remove only the target row")
		}
		checkList(t, want)
		for _, tc := range []struct {
			method string
			id     int
		}{
			{http.MethodGet, created.ID},
			{http.MethodDelete, created.ID},
			{http.MethodDelete, created.ID + 1000},
		} {
			rec := request(tc.method, "", "", tc.id)
			if rec.Code != http.StatusNotFound {
				t.Fatalf("%s/%d: status=%d body=%s", tc.method, tc.id, rec.Code, rec.Body.String())
			}
		}
		if !reflect.DeepEqual(snapshot(), want) {
			t.Fatal("requests for missing receipts changed other rows")
		}
	})
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
