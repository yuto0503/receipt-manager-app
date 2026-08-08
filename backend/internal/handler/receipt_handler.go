package handler

import (
	"errors"
	"net/http"
	"strconv"

	"github.com/labstack/echo/v4"
	"github.com/yuto-yamazaki/receipt-manager-app/backend/internal/model"
	"github.com/yuto-yamazaki/receipt-manager-app/backend/internal/repository"
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

// 登録API
func (h *ReceiptHandler) CreateReceipt(c echo.Context) error {
	var receipt model.Receipt

	if err := c.Bind(&receipt); err != nil {
		return c.JSON(
			http.StatusInternalServerError,
			map[string]string{
				"message": "リクエストが不正です",
			},
		)
	}
	createdReceipt, err := h.service.CreateReceipt(receipt)

	if err != nil {
		return c.JSON(
			http.StatusInternalServerError,
			map[string]string{
				"message": "レシートの登録に失敗しました。",
			},
		)
	}

	return c.JSON(http.StatusCreated, createdReceipt)
}

// 更新API
func (h *ReceiptHandler) UpdateReceipt(c echo.Context) error {
	var receipt model.Receipt

	if err := c.Bind(&receipt); err != nil {
		return c.JSON(
			http.StatusBadRequest,
			map[string]string{
				"message": "リクエストが不正です",
			},
		)
	}
	updatedReceipt, err := h.service.UpdateReceipt(receipt)

	if err != nil {
		if errors.Is(err, repository.ErrReceiptNotFound) {
			return c.JSON(
				http.StatusNotFound,
				map[string]string{
					"message": "レシートが存在しません。",
				},
			)
		}

		return c.JSON(
			http.StatusInternalServerError,
			map[string]string{
				"message": "更新に失敗しました。",
			},
		)
	}

	return c.JSON(http.StatusOK, updatedReceipt)
}
