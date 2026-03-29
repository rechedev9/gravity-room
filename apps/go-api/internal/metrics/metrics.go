package metrics

import (
	"regexp"
	"strconv"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/collectors"
)

// Registry is a custom Prometheus registry (not the global default).
// Matches TS: new Registry() + collectDefaultMetrics({register: registry}).
var Registry = prometheus.NewRegistry()

// Metrics matching the TS prom-client definitions (lib/metrics.ts).
var (
	HTTPRequestDuration = prometheus.NewHistogramVec(prometheus.HistogramOpts{
		Name:    "http_request_duration_seconds",
		Help:    "HTTP request duration in seconds",
		Buckets: []float64{0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5},
	}, []string{"method", "route", "status_code"})

	HTTPRequestsTotal = prometheus.NewCounterVec(prometheus.CounterOpts{
		Name: "http_requests_total",
		Help: "Total HTTP requests",
	}, []string{"method", "route", "status_code"})

	RateLimitHitsTotal = prometheus.NewCounterVec(prometheus.CounterOpts{
		Name: "rate_limit_hits_total",
		Help: "Total rate limit hits",
	}, []string{"endpoint"})

	HTTPErrorsTotal = prometheus.NewCounterVec(prometheus.CounterOpts{
		Name: "http_errors_total",
		Help: "Total HTTP errors",
	}, []string{"status_class", "error_code"})

	DBQueriesTotal = prometheus.NewCounterVec(prometheus.CounterOpts{
		Name: "db_queries_total",
		Help: "Total database queries",
	}, []string{"query_type"})
)

func init() {
	Registry.MustRegister(collectors.NewGoCollector())
	Registry.MustRegister(collectors.NewProcessCollector(collectors.ProcessCollectorOpts{}))
	Registry.MustRegister(
		HTTPRequestDuration,
		HTTPRequestsTotal,
		RateLimitHitsTotal,
		HTTPErrorsTotal,
		DBQueriesTotal,
	)
}

// Route normalisation — matches TS plugins/metrics.ts normaliseRoute().
var (
	uuidRe    = regexp.MustCompile(`[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}`)
	numericRe = regexp.MustCompile(`/\d+`)
)

// NormaliseRoute replaces UUIDs with :id and numeric segments with /:n
// to prevent label cardinality explosion.
func NormaliseRoute(path string) string {
	s := uuidRe.ReplaceAllString(path, ":id")
	s = numericRe.ReplaceAllString(s, "/:n")
	return s
}

// StatusClass returns "4xx" or "5xx" for a given status code.
func StatusClass(code int) string {
	if code >= 500 {
		return "5xx"
	}
	return "4xx"
}

// StatusStr converts an int status code to string for Prometheus labels.
func StatusStr(code int) string {
	return strconv.Itoa(code)
}
