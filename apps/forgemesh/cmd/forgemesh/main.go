package main

import (
	"forge.studio/portfolio/forgemesh/internal/mesh"
	"log"
	"net/http"
	"os"
	"strconv"
	"time"
)

func main() {
	port := 4831
	if env := os.Getenv("PORT"); env != "" {
		number, err := strconv.Atoi(env)
		if err != nil || number < 1 || number > 65535 {
			log.Fatal("PORT must be an integer from 1 through 65535")
		}
		port = number
	}
	// Loopback is mandatory: X-Client-Id is not authentication.
	address := "127.0.0.1:" + strconv.Itoa(port)
	server := &http.Server{
		Addr:              address,
		Handler:           mesh.NewService(1000),
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       10 * time.Second,
		WriteTimeout:      10 * time.Second,
		IdleTimeout:       30 * time.Second,
	}
	log.Printf("ForgeMesh local demo listening on %s", address)
	log.Fatal(server.ListenAndServe())
}
