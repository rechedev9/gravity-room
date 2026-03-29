package metrics

import "testing"

func TestNormaliseRoute_UUID(t *testing.T) {
	input := "/api/programs/550e8400-e29b-41d4-a716-446655440000/results"
	want := "/api/programs/:id/results"
	got := NormaliseRoute(input)
	if got != want {
		t.Errorf("NormaliseRoute(%q) = %q, want %q", input, got, want)
	}
}

func TestNormaliseRoute_Numeric(t *testing.T) {
	input := "/api/programs/123/results/456"
	want := "/api/programs/:n/results/:n"
	got := NormaliseRoute(input)
	if got != want {
		t.Errorf("NormaliseRoute(%q) = %q, want %q", input, got, want)
	}
}

func TestNormaliseRoute_Mixed(t *testing.T) {
	input := "/api/programs/550e8400-e29b-41d4-a716-446655440000/results/5"
	want := "/api/programs/:id/results/:n"
	got := NormaliseRoute(input)
	if got != want {
		t.Errorf("NormaliseRoute(%q) = %q, want %q", input, got, want)
	}
}

func TestNormaliseRoute_NoChange(t *testing.T) {
	input := "/health"
	got := NormaliseRoute(input)
	if got != input {
		t.Errorf("NormaliseRoute(%q) = %q, want no change", input, got)
	}
}

func TestStatusClass(t *testing.T) {
	tests := []struct{ code int; want string }{
		{400, "4xx"}, {404, "4xx"}, {429, "4xx"},
		{500, "5xx"}, {503, "5xx"},
	}
	for _, tc := range tests {
		if got := StatusClass(tc.code); got != tc.want {
			t.Errorf("StatusClass(%d) = %q, want %q", tc.code, got, tc.want)
		}
	}
}
