package main

import (
	"log"
	"net/http"

	"github.com/labstack/echo/v4"
	"github.com/yuto-yamazaki/receipt-manager-app/backend/internal/database"
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

	e.GET("/health", func(c echo.Context) error {
		return c.JSON(http.StatusOK, map[string]string{
			"status": "ok",
		})
	})

	e.Logger.Fatal(e.Start(":8080"))
}
