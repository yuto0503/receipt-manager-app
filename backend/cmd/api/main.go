package main

import (
	"log"

	"github.com/labstack/echo/v4"
	"github.com/yuto-yamazaki/receipt-manager-app/backend/internal/database"
	"github.com/yuto-yamazaki/receipt-manager-app/backend/internal/handler"
	"github.com/yuto-yamazaki/receipt-manager-app/backend/internal/repository"
	"github.com/yuto-yamazaki/receipt-manager-app/backend/internal/router"
	"github.com/yuto-yamazaki/receipt-manager-app/backend/internal/service"
)

func main() {
	// アプリ起動時接続
	db, err := database.Connect()
	if err != nil {
		log.Fatalf("DB接続に失敗しました。:%v", err)
	}
	defer db.Close()

	log.Println("DB接続に成功しました。")

	e := echo.New()
	receiptRepository := repository.NewReceiptRepository(db)
	receiptService := service.NewReceiptService(receiptRepository)
	receiptHandler := handler.NewReceiptHandler(receiptService)

	// ルーティングの登録
	router.SetupRouter(e, receiptHandler)

	// サーバーの起動
	e.Logger.Fatal(e.Start(":8080"))
}
