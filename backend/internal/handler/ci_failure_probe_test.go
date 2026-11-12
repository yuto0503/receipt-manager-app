package handler

import "testing"

func TestCIFailureProbe(t *testing.T) {
	t.Fatal("CI_FAILURE_PROBE_BACKEND: intentional failure on verification branch only")
}
