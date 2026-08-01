package service

import (
	"github.com/yuto-yamazaki/receipt-manager-app/backend/internal/model"
	"github.com/yuto-yamazaki/receipt-manager-app/backend/internal/repository"
)

type ReceiptService struct {
	repository *repository.ReceiptRepository
}

func NewReceiptService(repository *repository.ReceiptRepository) *ReceiptService {
	return &ReceiptService{
		repository: repository,
	}
}

func (s *ReceiptService) GetReceipts() ([]model.Receipt, error) {
	return s.repository.GetReceipts()
}
