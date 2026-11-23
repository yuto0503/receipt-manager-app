package router

import (
	"context"
	"database/sql"
	"database/sql/driver"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/labstack/echo/v4"
	"github.com/yuto-yamazaki/receipt-manager-app/backend/internal/handler"
	"github.com/yuto-yamazaki/receipt-manager-app/backend/internal/repository"
	"github.com/yuto-yamazaki/receipt-manager-app/backend/internal/service"
)

func TestDeleteReceipt(t *testing.T) {
	for _, tc := range []struct {
		name    string
		result  driver.Result
		err     error
		status  int
		message string
	}{
		{"deleted", driver.RowsAffected(1), nil, http.StatusNoContent, ""},
		{"not_found", driver.RowsAffected(0), nil, http.StatusNotFound, "レシートが存在しません。"},
		{"database_failure", nil, errors.New("private database error"), http.StatusInternalServerError, "レシートの削除に失敗しました。"},
		{"rows_affected_failure", deleteResultError{}, nil, http.StatusInternalServerError, "レシートの削除に失敗しました。"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			conn := &receiptDeleteConn{receiptQueryConn: receiptQueryConn{t: t}, result: tc.result, err: tc.err}
			db := sql.OpenDB(deleteConnector{conn})
			t.Cleanup(func() { db.Close() })
			e := echo.New()
			SetupRouter(e, handler.NewReceiptHandler(service.NewReceiptService(repository.NewReceiptRepository(db))))
			rec := httptest.NewRecorder()
			e.ServeHTTP(rec, httptest.NewRequest(http.MethodDelete, "/receipts/123", nil))
			if rec.Code != tc.status {
				t.Fatalf("status=%d want=%d body=%s", rec.Code, tc.status, rec.Body.String())
			}
			if !conn.executed {
				t.Fatal("DELETE was not executed")
			}
			if tc.status == http.StatusNoContent {
				if rec.Body.Len() != 0 {
					t.Fatalf("expected empty body: %s", rec.Body.String())
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

type receiptDeleteConn struct {
	receiptQueryConn
	result   driver.Result
	err      error
	executed bool
}

func (c *receiptDeleteConn) ExecContext(_ context.Context, query string, args []driver.NamedValue) (driver.Result, error) {
	c.executed = true
	if strings.Join(strings.Fields(query), " ") != "DELETE FROM receipts WHERE id = ?" || len(args) != 1 || args[0].Value != int64(123) {
		c.t.Fatalf("expected physical deletion for URL ID 123: query=%s args=%v", query, args)
	}
	return c.result, c.err
}

type deleteConnector struct{ conn *receiptDeleteConn }

func (c deleteConnector) Connect(context.Context) (driver.Conn, error) { return c.conn, nil }
func (c deleteConnector) Driver() driver.Driver                        { return deleteDriver{c.conn} }

type deleteDriver struct{ conn *receiptDeleteConn }

func (d deleteDriver) Open(string) (driver.Conn, error) { return d.conn, nil }

type deleteResultError struct{}

func (deleteResultError) LastInsertId() (int64, error) {
	return 0, errors.New("unexpected LastInsertId")
}
func (deleteResultError) RowsAffected() (int64, error) { return 0, errors.New("private result error") }
