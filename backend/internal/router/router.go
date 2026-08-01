package router

import (
	"net/http"

	"github.com/labstack/echo/v4"
	"github.com/yuto-yamazaki/receipt-manager-app/backend/internal/handler"
)

func SetupRouter(e *echo.Echo, receiptHandler *handler.ReceiptHandler) {

	e.GET("/health", func(c echo.Context) error {
		return c.JSON(http.StatusOK, map[string]string{
			"status": "ok",
		})
	})

	e.GET("/receipts", receiptHandler.GetReceipts)
}
