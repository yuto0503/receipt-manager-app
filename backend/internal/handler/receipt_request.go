package handler

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"mime"
	"regexp"
	"strings"
	"time"

	"github.com/labstack/echo/v4"
	"github.com/yuto-yamazaki/receipt-manager-app/backend/internal/model"
)

// The pointer distinguishes an omitted/null price from an explicit zero.
// Receipt stays unchanged for persistence and response serialization.
type receiptRequest struct {
	model.Receipt
	Price        *int64  `json:"price"`
	PurchaseDate *string `json:"purchase_date"`
}

const purchaseDateFormatMessage = "購入日はRFC 3339形式（例: 2026-09-21T00:00:00+09:00）の実在する日時で入力してください。"

// Goの日時パーサーが許容する1桁の時刻や小数点のカンマを除外する。
var purchaseDatePattern = regexp.MustCompile(`^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,9})?(Z|[+-]([01]\d|2[0-3]):[0-5]\d)$`)

func bindReceipt(c echo.Context) (model.Receipt, error) {
	mediaType, _, err := mime.ParseMediaType(c.Request().Header.Get(echo.HeaderContentType))
	if err != nil || mediaType != echo.MIMEApplicationJSON {
		return model.Receipt{}, errors.New("Content-Typeをapplication/jsonにして送信してください。")
	}
	// 本文全体を確認してから各項目を検証する。
	decoder := json.NewDecoder(c.Request().Body)
	var body json.RawMessage
	if err := decoder.Decode(&body); err != nil {
		if errors.Is(err, io.EOF) {
			return model.Receipt{}, errors.New("リクエスト本文にJSONオブジェクトを指定してください。")
		}
		return model.Receipt{}, errors.New("JSONの形式が不正です。括弧・カンマ・引用符を確認してください。")
	}
	var extra json.RawMessage
	if err := decoder.Decode(&extra); err != io.EOF {
		return model.Receipt{}, errors.New("リクエスト本文にはJSONオブジェクトを1つだけ指定してください。末尾の余分なデータを削除してください。")
	}
	if len(body) == 0 || body[0] != '{' {
		return model.Receipt{}, errors.New("リクエスト本文はJSONオブジェクト（{...}）で指定してください。")
	}
	var request receiptRequest
	if err := json.Unmarshal(body, &request); err != nil {
		var typeError *json.UnmarshalTypeError
		if errors.As(err, &typeError) {
			// 埋め込んだReceiptのフィールド名には型名が付く。
			switch strings.TrimPrefix(typeError.Field, "Receipt.") {
			case "id":
				return model.Receipt{}, errors.New("IDは整数で入力してください。")
			case "created_at", "updated_at":
				return model.Receipt{}, errors.New("作成日時・更新日時はRFC 3339形式の日時文字列で入力してください。")
			case "store_name":
				return model.Receipt{}, errors.New("店名は文字列で入力してください。")
			case "category":
				return model.Receipt{}, errors.New("カテゴリは文字列で入力してください。")
			case "memo":
				return model.Receipt{}, errors.New("メモは文字列で入力してください。")
			case "purchase_date":
				return model.Receipt{}, errors.New(purchaseDateFormatMessage)
			case "price":
				return model.Receipt{}, fmt.Errorf("金額は0円以上%d円以下の整数で入力してください。", model.PriceMax)
			}
		}
		var dateError *time.ParseError
		if errors.As(err, &dateError) {
			return model.Receipt{}, errors.New("作成日時・更新日時はRFC 3339形式の日時文字列で入力してください。")
		}
		return model.Receipt{}, errors.New("入力値の型が不正です。各項目の入力形式を確認してください。")
	}
	if request.Price == nil {
		return model.Receipt{}, errors.New("金額を指定してください。0円も指定できます。")
	}
	if *request.Price < 0 || *request.Price > model.PriceMax {
		return model.Receipt{}, fmt.Errorf("金額は0円以上%d円以下の整数で入力してください。", model.PriceMax)
	}
	request.Receipt.Price = int(*request.Price)
	if request.PurchaseDate == nil || strings.TrimSpace(*request.PurchaseDate) == "" {
		return model.Receipt{}, errors.New("購入日を指定してください。")
	}
	if !purchaseDatePattern.MatchString(*request.PurchaseDate) {
		return model.Receipt{}, errors.New(purchaseDateFormatMessage)
	}
	date, err := time.Parse(time.RFC3339Nano, *request.PurchaseDate)
	if err != nil {
		return model.Receipt{}, errors.New(purchaseDateFormatMessage)
	}
	request.Receipt.PurchaseDate = date
	return request.Receipt, request.Receipt.Validate()
}
