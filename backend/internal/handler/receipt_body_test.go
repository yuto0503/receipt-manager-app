package handler

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/labstack/echo/v4"
)

func TestReceiptInvalidBody(t *testing.T) {
	valid := mustJSON(t, validReceiptPayload())
	for _, method := range []string{http.MethodPost, http.MethodPut} {
		for _, tc := range []struct{ name, body, contentType, message string }{
			{"empty", "", echo.MIMEApplicationJSON, "リクエスト本文にJSONオブジェクトを指定してください。"},
			{"whitespace", " \n\t", echo.MIMEApplicationJSON, "リクエスト本文にJSONオブジェクトを指定してください。"},
			{"truncated", `{"price":`, echo.MIMEApplicationJSON, "JSONの形式が不正です。括弧・カンマ・引用符を確認してください。"},
			{"comma", `{"price":1,}`, echo.MIMEApplicationJSON, "JSONの形式が不正です。括弧・カンマ・引用符を確認してください。"},
			{"null", `null`, echo.MIMEApplicationJSON, "リクエスト本文はJSONオブジェクト（{...}）で指定してください。"},
			{"array", `[]`, echo.MIMEApplicationJSON, "リクエスト本文はJSONオブジェクト（{...}）で指定してください。"},
			{"string", `"text"`, echo.MIMEApplicationJSON, "リクエスト本文はJSONオブジェクト（{...}）で指定してください。"},
			{"number", `123`, echo.MIMEApplicationJSON, "リクエスト本文はJSONオブジェクト（{...}）で指定してください。"},
			{"boolean", `true`, echo.MIMEApplicationJSON, "リクエスト本文はJSONオブジェクト（{...}）で指定してください。"},
			{"multiple", valid + ` {}`, echo.MIMEApplicationJSON, "リクエスト本文にはJSONオブジェクトを1つだけ指定してください。末尾の余分なデータを削除してください。"},
			{"trailing garbage", valid + ` xyz`, echo.MIMEApplicationJSON, "リクエスト本文にはJSONオブジェクトを1つだけ指定してください。末尾の余分なデータを削除してください。"},
			{"missing content type", valid, "", "Content-Typeをapplication/jsonにして送信してください。"},
			{"unsupported content type", valid, "text/plain", "Content-Typeをapplication/jsonにして送信してください。"},
			{"empty object", `{}`, echo.MIMEApplicationJSON, "金額を指定してください。0円も指定できます。"},
			{"invalid id", `{"id":"abc"}`, echo.MIMEApplicationJSON, "IDは整数で入力してください。"},
			{"invalid timestamp", `{"created_at":"invalid"}`, echo.MIMEApplicationJSON, "作成日時・更新日時はRFC 3339形式の日時文字列で入力してください。"},
		} {
			t.Run(method+"/"+tc.name, func(t *testing.T) {
				h := NewReceiptHandler(nil) // Service/DBに到達すると失敗する。
				e := echo.New()
				e.POST("/receipts", h.CreateReceipt)
				e.PUT("/receipts/:id", h.UpdateReceipt)
				path := "/receipts"
				if method == http.MethodPut {
					path += "/1"
				}
				req := httptest.NewRequest(method, path, strings.NewReader(tc.body))
				req.Header.Set(echo.HeaderContentType, tc.contentType)
				rec := httptest.NewRecorder()
				e.ServeHTTP(rec, req)
				var response map[string]string
				if err := json.Unmarshal(rec.Body.Bytes(), &response); err != nil {
					t.Fatal(err)
				}
				if rec.Code != http.StatusBadRequest || response["message"] != tc.message {
					t.Fatalf("status=%d body=%s", rec.Code, rec.Body.String())
				}
				if !strings.HasPrefix(rec.Header().Get(echo.HeaderContentType), echo.MIMEApplicationJSON) {
					t.Fatal("response must be JSON")
				}
			})
		}
	}
}

func TestBindReceiptJSONWhitespaceAndCharset(t *testing.T) {
	for _, method := range []string{http.MethodPost, http.MethodPut} {
		req := httptest.NewRequest(method, "/receipts/1", strings.NewReader(" \n"+mustJSON(t, validReceiptPayload())+" \n\t"))
		req.Header.Set(echo.HeaderContentType, "application/json; charset=utf-8")
		r, err := bindReceipt(echo.New().NewContext(req, httptest.NewRecorder()))
		if err != nil {
			t.Fatal(err)
		}
		if r.StoreName != "店舗" || r.Price != 100 || r.Category != "食費" {
			t.Fatalf("unexpected receipt: %+v", r)
		}
	}
}
