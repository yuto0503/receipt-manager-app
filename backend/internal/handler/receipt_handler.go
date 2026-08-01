package handler

import (
	"net/http"

	"github.com/labstack/echo/v4"
	"github.com/yuto-yamazaki/receipt-manager-app/backend/internal/service"
)

type ReceiptHandler struct {
	service *service.ReceiptService
}

func NewReceiptHandler(service *service.ReceiptService) *ReceiptHandler {
	return &ReceiptHandler{
		service: service,
	}
}

func (h *ReceiptHandler) GetReceipts(c echo.Context) error {
	receipts, err := h.service.GetReceipts()

	if err != nil {
		return c.JSON(
			http.StatusInternalServerError,
			map[string]string{
				"message": "レシートの取得に失敗しました。",
			},
		)
	}

	return c.JSON(http.StatusOK, receipts)
}
