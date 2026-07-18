package database

import (
	"database/sql"
	"fmt"
	"log"
	"os"
	"time"

	_ "github.com/go-sql-driver/mysql"
)

func Connect() (*sql.DB, error) {
	// 環境変数取得
	user := os.Getenv("DB_USER")
	password := os.Getenv("DB_PASSWORD")
	host := os.Getenv("DB_HOST")
	port := os.Getenv("DB_PORT")
	dbName := os.Getenv("DB_NAME")

	// DNS作成
	dsn := fmt.Sprintf(
		"%s:%s@tcp(%s:%s)/%s?parseTime=true",
		user,
		password,
		host,
		port,
		dbName,
	)

	log.Println(dsn)

	db, err := sql.Open("mysql", dsn)
	if err != nil {
		return nil, err
	}

	for i := 1; i <= 10; i++ {
		if err := db.Ping(); err == nil {
			return db, nil
		}

		log.Printf("DB接続待機中...(%d/10)", i)
		time.Sleep(2 * time.Second)
	}

	return nil, fmt.Errorf("DB接続タイムアウト")
}
