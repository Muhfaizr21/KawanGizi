package controllers

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestWantsHTML(t *testing.T) {
	cases := []struct {
		name   string
		accept string
		want   bool
	}{
		{"browser chrome", "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8", true},
		{"browser edge", "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8", true},
		{"curl wildcard", "*/*", false},
		{"explicit json", "application/json", false},
		{"json preferred", "application/json;q=0.9,text/html;q=0.5", false},
		{"subtype wildcard", "text/*", true},
		{"empty", "", false},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := wantsHTML(tc.accept); got != tc.want {
				t.Fatalf("wantsHTML(%q) = %v, want %v", tc.accept, got, tc.want)
			}
		})
	}
}

func TestLandingPageRenderFillsPlaceholders(t *testing.T) {
	page := LandingPage{AppEnv: "staging", Port: "9000", AIURL: "http://127.0.0.1:9999", WebURL: "http://localhost:4000"}
	html := string(page.Render())

	for _, want := range []string{"staging", "9000", "http://127.0.0.1:9999", "http://localhost:4000"} {
		if !strings.Contains(html, want) {
			t.Fatalf("rendered landing page missing %q", want)
		}
	}
	if strings.Contains(html, "{{") {
		t.Fatal("rendered landing page still contains unresolved placeholders")
	}
}

func TestRootServesLandingPageForBrowsers(t *testing.T) {
	ctrl := NewHealthController(LandingPage{AppEnv: "development", Port: "8080", AIURL: "http://127.0.0.1:8083", WebURL: "http://localhost:5173"}, nil)

	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req.Header.Set("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8")
	rec := httptest.NewRecorder()
	ctrl.Root(rec, req)

	if got := rec.Header().Get("Content-Type"); got != "text/html; charset=utf-8" {
		t.Fatalf("Content-Type = %q, want text/html", got)
	}
	if body := rec.Body.String(); !strings.Contains(body, "Selamat Datang di KawanGizi Backend") {
		t.Fatal("browser response does not contain the themed welcome popup")
	}
}

func TestRootServesJSONForAPIClients(t *testing.T) {
	ctrl := NewHealthController(LandingPage{AppEnv: "development", Port: "8080"}, nil)

	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req.Header.Set("Accept", "application/json")
	rec := httptest.NewRecorder()
	ctrl.Root(rec, req)

	if got := rec.Header().Get("Content-Type"); got != "application/json" {
		t.Fatalf("Content-Type = %q, want application/json", got)
	}
	if body := rec.Body.String(); !strings.Contains(body, `"docs":"/swagger/index.html"`) {
		t.Fatalf("unexpected JSON body: %s", body)
	}
}