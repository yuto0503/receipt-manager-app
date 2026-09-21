package handler

import (
	"encoding/json"
	"errors"
	"fmt"
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
	var request receiptRequest
	if err := c.Bind(&request); err != nil {
		var typeError *json.UnmarshalTypeError
		if errors.As(err, &typeError) {
			// 埋め込んだReceiptのフィールド名には型名が付く。
			switch strings.TrimPrefix(typeError.Field, "Receipt.") {
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
		return model.Receipt{}, errors.New("リクエストが不正です")
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
