package controllers

import (
	_ "embed"
	"strconv"
	"strings"
)

//go:embed landing.html
var landingTemplate string

// LandingPage holds the runtime values injected into the branded landing page
// served on the API root when a browser requests it.
type LandingPage struct {
	AppEnv  string
	Port    string
	AIURL   string
	WebURL  string
	Version string
}

// Render substitutes the placeholders in the embedded template. The template is
// static, so the replacement result is cached to avoid rebuilding per request.
func (l LandingPage) Render() []byte {
	version := l.Version
	if version == "" {
		version = "1.0.0"
	}

	replacer := strings.NewReplacer(
		"{{APP_ENV}}", l.AppEnv,
		"{{PORT}}", l.Port,
		"{{AI_URL}}", l.AIURL,
		"{{WEB_URL}}", l.WebURL,
		"{{VERSION}}", version,
	)
	return []byte(replacer.Replace(landingTemplate))
}

// wantsHTML reports whether the client prefers an HTML document over JSON.
// Browsers advertise text/html with a higher quality value than the */*
// wildcard, while curl, Postman, and mobile clients either ask for JSON or use
// a plain wildcard; ties resolve to JSON so existing API consumers are safe.
func wantsHTML(accept string) bool {
	if accept == "" {
		return false
	}
	htmlQ := acceptQuality(accept, "text/html")
	jsonQ := acceptQuality(accept, "application/json")
	return htmlQ > jsonQ
}

// acceptQuality returns the best quality value of the media ranges matching
// mediaType, taking wildcards into account. Ranges without an explicit q value
// default to 1.
func acceptQuality(accept, mediaType string) float64 {
	best := 0.0

	group, _, _ := strings.Cut(mediaType, "/")

	for _, entry := range strings.Split(accept, ",") {
		parts := strings.Split(strings.TrimSpace(entry), ";")
		candidate := strings.ToLower(strings.TrimSpace(parts[0]))

		quality := 1.0
		for _, param := range parts[1:] {
			key, value, found := strings.Cut(param, "=")
			if !found || strings.TrimSpace(key) != "q" {
				continue
			}
			parsed, err := strconv.ParseFloat(strings.TrimSpace(value), 64)
			if err != nil {
				quality = 0
				break
			}
			quality = parsed
		}

		candidateGroup, candidateSubtype, _ := strings.Cut(candidate, "/")
		matched := candidate == mediaType ||
			(candidate == "*/*" && mediaType != "*/*") ||
			(candidateGroup == group && candidateSubtype == "*")
		if matched && quality > best {
			best = quality
		}
	}

	return best
}