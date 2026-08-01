package handler

import (
	"net/http"
	"strconv"

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

// 一覧取得
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

// 1件取得
func (h *ReceiptHandler) GetReceiptByID(c echo.Context) error {
	// intに変更
	id, err := strconv.Atoi(c.Param("id"))
	receipt, err := h.service.GetReceiptByID(id)

	if err != nil {
		return c.JSON(
			http.StatusInternalServerError,
			map[string]string{
				"message": "レシートの取得に失敗しました。",
			},
		)
	}

	return c.JSON(http.StatusOK, receipt)
}
