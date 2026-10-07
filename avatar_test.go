package main

import (
	"encoding/json"
	"strings"
	"testing"
)

// Model output is shown to every visitor, so nothing but plain shapes may survive parsing.
func TestParseSlotKeepsOnlySafeShapes(t *testing.T) {
	got := parseSlot(`
		<path d="M0,0 L10,10Z" fill="HAIR" onclick="alert(1)" style="fill:red" class="x"/>
		<script>alert(1)</script>
		<circle cx="1" cy="2" r="3" fill="url(#evil)" stroke="javascript:alert(1)"/>
		<image href="https://example.com/x.png" x="0" y="0"/>
		<a href="https://example.com"><rect x="1" y="2" width="3" height="4" fill="#abc"/></a>
		<foreignObject><div>hi</div></foreignObject>
		<text x="0" y="0">hello</text>
		<use href="#star"/>
		<path d="M0,0 l5,5" fill="red" transform="matrix(1,0,0,1,0,0)"/>
		<rect x="0" y="0" width="5" height="5" transform="rotate(20 31 261)" fill="none"/>`)

	want := []Shape{
		{"path", map[string]string{"d": "M0,0 L10,10Z", "fill": "HAIR"}},
		{"circle", map[string]string{"cx": "1", "cy": "2", "r": "3"}},
		{"rect", map[string]string{"x": "1", "y": "2", "width": "3", "height": "4", "fill": "#abc"}},
		{"path", map[string]string{"d": "M0,0 l5,5"}},
		{"rect", map[string]string{"x": "0", "y": "0", "width": "5", "height": "5", "transform": "rotate(20 31 261)", "fill": "none"}},
	}
	a, _ := json.Marshal(got)
	b, _ := json.Marshal(want)
	if string(a) != string(b) {
		t.Fatalf("parseSlot kept the wrong things\n got: %s\nwant: %s", a, b)
	}
	if !validParts(map[string][]Shape{"face": got}) {
		t.Fatal("what parseSlot produces must pass validParts")
	}
}

func TestParseSlotSurvivesBrokenMarkup(t *testing.T) {
	if got := parseSlot(`<path d="M0,0" fill="#fff"><circle cx="1"`); len(got) != 1 {
		t.Fatalf("want the one complete shape, got %v", got)
	}
	if got := parseSlot(strings.Repeat(`<circle cx="1" cy="1" r="1"/>`, 100)); len(got) != maxShapesPerSlot {
		t.Fatalf("want at most %d shapes, got %d", maxShapesPerSlot, len(got))
	}
}

// Parts come back from the browser when a stage is created; a tampered request must be refused.
func TestValidPartsRefusesTampering(t *testing.T) {
	ok := Shape{"circle", map[string]string{"cx": "1", "cy": "1", "r": "1"}}
	bad := map[string]map[string][]Shape{
		"unknown slot":   {"body": {ok}},
		"unknown tag":    {"face": {{"script", map[string]string{}}}},
		"unknown attr":   {"face": {{"circle", map[string]string{"onload": "x"}}}},
		"url paint":      {"face": {{"circle", map[string]string{"fill": "url(#a)"}}}},
		"markup in path": {"face": {{"path", map[string]string{"d": `M0,0"/><script>`}}}},
		"too many":       {"face": slicesRepeat(ok, maxShapesPerSlot+1)},
	}
	for name, parts := range bad {
		if validParts(parts) {
			t.Errorf("%s: should be refused", name)
		}
	}
	if !validParts(nil) || !validParts(map[string][]Shape{"headwear": {ok}}) {
		t.Error("no parts, and well-formed parts, should be accepted")
	}
}

func slicesRepeat(s Shape, n int) []Shape {
	out := make([]Shape, n)
	for i := range out {
		out[i] = s
	}
	return out
}
