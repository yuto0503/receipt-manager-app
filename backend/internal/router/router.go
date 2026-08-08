package router

import (
	"net/http"

	"github.com/labstack/echo/v4"
	"github.com/yuto-yamazaki/receipt-manager-app/backend/internal/handler"
)

func SetupRouter(e *echo.Echo, receiptHandler *handler.ReceiptHandler) {

	// システム状態確認用
	e.GET("/health", func(c echo.Context) error {
		return c.JSON(http.StatusOK, map[string]string{
			"status": "ok",
		})
	})

	// 一覧取得
	e.GET("/receipts", receiptHandler.GetReceipts)

	// 1件取得
	e.GET("/receipts/:id", receiptHandler.GetReceipts)

}
