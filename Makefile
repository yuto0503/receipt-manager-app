MYSQL_USER=root
MYSQL_PASSWORD=password
MYSQL_DATABASE=receipt_app

MIGRATION_PATH=/migrations
DATABASE_URL=mysql://$(MYSQL_USER):$(MYSQL_PASSWORD)@tcp(mysql:3306)/$(MYSQL_DATABASE)

# マイグレーションファイルを読み込んで、テーブルを作成する。
migrate-up:
	docker compose run --rm migrate \
		-path=$(MIGRATION_PATH) \
		-database "$(DATABASE_URL)" \
		up

# マイグレーションファイルを取り消して、テーブルを削除する。
migrate-down:
	docker compose run --rm migrate \
		-path=$(MIGRATION_PATH) \
		-database "$(DATABASE_URL)" \
		down