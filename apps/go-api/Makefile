.PHONY: build run test lint vet clean

BIN := bin/api

build:
	go build -o $(BIN) ./cmd/api

run: build
	./$(BIN)

test:
	go test ./...

lint:
	golangci-lint run ./...

vet:
	go vet ./...

clean:
	rm -rf bin/
