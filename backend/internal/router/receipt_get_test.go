package router

import (
	"context"
	"database/sql"
	"database/sql/driver"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"reflect"
	"strings"
	"testing"
	"time"

	"github.com/labstack/echo/v4"
	"github.com/yuto-yamazaki/receipt-manager-app/backend/internal/handler"
	"github.com/yuto-yamazaki/receipt-manager-app/backend/internal/model"
	"github.com/yuto-yamazaki/receipt-manager-app/backend/internal/repository"
	"github.com/yuto-yamazaki/receipt-manager-app/backend/internal/service"
)

// Exercise the real Router, Handler, Service and Repository with controlled SQL results.
func TestGetReceiptByID(t *testing.T) {
	date := time.Date(2026, 10, 4, 0, 0, 0, 0, time.UTC)
	want := model.Receipt{ID: 123, StoreName: "店舗", Price: 500, PurchaseDate: date, Category: "食費", Memo: "メモ", CreatedAt: date, UpdatedAt: date}
	for _, tc := range []struct {
		name    string
		values  []driver.Value
		err     error
		status  int
		message string
	}{
		{"found", []driver.Value{int64(123), want.StoreName, int64(want.Price), date, want.Category, want.Memo, date, date}, nil, http.StatusOK, ""},
		{"not_found", nil, nil, http.StatusNotFound, "レシートが存在しません。"},
		{"database_failure", nil, errors.New("database unavailable"), http.StatusInternalServerError, "レシートの取得に失敗しました。"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			conn := &receiptQueryConn{t: t, values: tc.values, err: tc.err}
			db := sql.OpenDB(receiptConnector{conn})
			t.Cleanup(func() { db.Close() })
			e := echo.New()
			SetupRouter(e, handler.NewReceiptHandler(service.NewReceiptService(repository.NewReceiptRepository(db))))
			rec := httptest.NewRecorder()
			e.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/receipts/123", nil))
			if rec.Code != tc.status {
				t.Fatalf("status=%d want=%d body=%s", rec.Code, tc.status, rec.Body.String())
			}
			if !conn.queried {
				t.Fatal("database was not queried")
			}
			if tc.status == http.StatusOK {
				var got model.Receipt
				// Decoding into a struct also rejects an array response.
				if err := json.Unmarshal(rec.Body.Bytes(), &got); err != nil {
					t.Fatal(err)
				}
				if !reflect.DeepEqual(got, want) {
					t.Fatalf("receipt=%+v want=%+v", got, want)
				}
			} else {
				var got map[string]string
				if err := json.Unmarshal(rec.Body.Bytes(), &got); err != nil || got["message"] != tc.message {
					t.Fatalf("unexpected error response: %s", rec.Body.String())
				}
			}
		})
	}
}

type receiptConnector struct{ conn *receiptQueryConn }

func (c receiptConnector) Connect(context.Context) (driver.Conn, error) { return c.conn, nil }
func (c receiptConnector) Driver() driver.Driver                        { return receiptDriver{c.conn} }

type receiptDriver struct{ conn *receiptQueryConn }

func (d receiptDriver) Open(string) (driver.Conn, error) { return d.conn, nil }

type receiptQueryConn struct {
	t       *testing.T
	values  []driver.Value
	err     error
	queried bool
}

func (c *receiptQueryConn) Prepare(string) (driver.Stmt, error) {
	return nil, errors.New("unexpected prepare")
}
func (c *receiptQueryConn) Close() error { return nil }
func (c *receiptQueryConn) Begin() (driver.Tx, error) {
	return nil, errors.New("unexpected transaction")
}
func (c *receiptQueryConn) QueryContext(_ context.Context, query string, args []driver.NamedValue) (driver.Rows, error) {
	c.queried = true
	if !strings.Contains(strings.Join(strings.Fields(query), " "), "WHERE id = ?") || len(args) != 1 || args[0].Value != int64(123) {
		c.t.Fatalf("expected query for URL ID 123: query=%s args=%v", query, args)
	}
	if c.err != nil {
		return nil, c.err
	}
	return &receiptRows{values: c.values}, nil
}

type receiptRows struct{ values []driver.Value }

func (*receiptRows) Columns() []string {
	return []string{"id", "store_name", "price", "purchase_date", "category", "memo", "created_at", "updated_at"}
}
func (*receiptRows) Close() error { return nil }
func (r *receiptRows) Next(dest []driver.Value) error {
	if r.values == nil {
		return io.EOF
	}
	copy(dest, r.values)
	r.values = nil
	return nil
}
