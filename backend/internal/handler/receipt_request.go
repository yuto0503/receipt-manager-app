package handler

import (
	"encoding/json"
	"errors"
	"fmt"

	"github.com/labstack/echo/v4"
	"github.com/yuto-yamazaki/receipt-manager-app/backend/internal/model"
)

// The pointer distinguishes an omitted/null price from an explicit zero.
// Receipt stays unchanged for persistence and response serialization.
type receiptRequest struct {
	model.Receipt
	Price *int64 `json:"price"`
}

func bindReceipt(c echo.Context) (model.Receipt, error) {
	var request receiptRequest
	if err := c.Bind(&request); err != nil {
		var typeError *json.UnmarshalTypeError
		if errors.As(err, &typeError) && typeError.Field == "price" {
			return model.Receipt{}, fmt.Errorf("金額は0円以上%d円以下の整数で入力してください。", model.PriceMax)
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
	return request.Receipt, request.Receipt.Validate()
}
