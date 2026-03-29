.PHONY: build run test coverage lint vet clean

BIN := bin/api

build:
	go build -o $(BIN) ./cmd/api

run: build
	./$(BIN)

test:
	go test ./...

coverage:
	go test ./... -coverprofile=coverage.out
	go tool cover -html=coverage.out -o coverage.html
	@echo "Coverage report: coverage.html"

lint:
	golangci-lint run ./...

vet:
	go vet ./...

clean:
	rm -rf bin/
