.PHONY: up down reset logs seed
up:     ; docker compose up --build
down:   ; docker compose down
reset:  ; docker compose down -v
logs:   ; docker compose logs -f
