package conditionalbundle

import (
	"fmt"
	"os"
	"path"
	"path/filepath"
	"regexp"
	"strings"

	"github.com/Knetic/govaluate"
	"github.com/bmatcuk/doublestar/v4"
	"github.com/evanw/esbuild/pkg/api"
)

type Options struct {
	Includes []string
	Excludes []string
	Vars     map[string]any
}

type stackState struct {
	matched      bool
	hasHandled   bool
	parentActive bool
}

var (
	ifRegexp    = regexp.MustCompile(`^[ \t]*//[ \t]*#if[ \t]+(.+)$`)
	elifRegexp  = regexp.MustCompile(`^[ \t]*//[ \t]*#elif[ \t]+(.+)$`)
	elseRegexp  = regexp.MustCompile(`^[ \t]*//[ \t]*#else[ \t]*$`)
	endifRegexp = regexp.MustCompile(`^[ \t]*//[ \t]*#endif[ \t]*$`)
)

func Plugin(options Options) api.Plugin {
	cwd, err := os.Getwd()
	if err != nil {
		cwd = "."
	}

	return api.Plugin{
		Name: "esbuild-plugin-conditional-compile",
		Setup: func(build api.PluginBuild) {
			build.OnLoad(api.OnLoadOptions{Filter: ".*"}, func(args api.OnLoadArgs) (api.OnLoadResult, error) {
				if !matchFile(args.Path, options.Includes, options.Excludes, cwd) {
					return api.OnLoadResult{}, nil
				}

				source, err := os.ReadFile(args.Path)
				if err != nil {
					return api.OnLoadResult{}, err
				}

				result, changed, err := TransformConditional(string(source), options.Vars)
				if err != nil {
					return api.OnLoadResult{
						Errors: []api.Message{{Text: err.Error()}},
					}, nil
				}

				if !changed {
					return api.OnLoadResult{}, nil
				}

				return api.OnLoadResult{
					Contents:   &result,
					Loader:     inferLoader(args.Path),
					ResolveDir: filepath.Dir(args.Path),
				}, nil
			})
		},
	}
}

func TransformConditional(code string, vars map[string]any) (string, bool, error) {
	normalized := strings.ReplaceAll(code, "\r\n", "\n")
	hasTrailingNewLine := strings.HasSuffix(normalized, "\n")
	content := strings.TrimSuffix(normalized, "\n")

	if content == "" {
		return code, false, nil
	}

	lines := strings.Split(content, "\n")
	stack := make([]stackState, 0)
	var builder strings.Builder
	changed := false

	for index, line := range lines {
		isDirective := false

		if matches := ifRegexp.FindStringSubmatch(line); matches != nil {
			parentActive := allMatched(stack)
			isTrue := false
			if parentActive {
				isTrue = evaluateCondition(matches[1], vars)
			}
			stack = append(stack, stackState{
				matched:      isTrue,
				hasHandled:   isTrue,
				parentActive: parentActive,
			})
			isDirective = true
		} else if matches := elifRegexp.FindStringSubmatch(line); matches != nil {
			if len(stack) == 0 {
				return "", false, fmt.Errorf("[ConditionalPlugin] #elif without #if")
			}

			top := &stack[len(stack)-1]
			if top.hasHandled || !top.parentActive {
				top.matched = false
			} else {
				isTrue := evaluateCondition(matches[1], vars)
				top.matched = isTrue
				if isTrue {
					top.hasHandled = true
				}
			}
			isDirective = true
		} else if elseRegexp.MatchString(line) {
			if len(stack) == 0 {
				return "", false, fmt.Errorf("[ConditionalPlugin] #else without #if")
			}

			top := &stack[len(stack)-1]
			top.matched = top.parentActive && !top.hasHandled
			top.hasHandled = true
			isDirective = true
		} else if endifRegexp.MatchString(line) {
			if len(stack) == 0 {
				return "", false, fmt.Errorf("[ConditionalPlugin] #endif without #if")
			}

			stack = stack[:len(stack)-1]
			isDirective = true
		}

		shouldInclude := allMatched(stack)
		if isDirective || !shouldInclude {
			changed = true
			continue
		}

		builder.WriteString(line)
		if index < len(lines)-1 || hasTrailingNewLine {
			builder.WriteByte('\n')
		}
	}

	if len(stack) > 0 {
		return "", false, fmt.Errorf("[ConditionalPlugin] missing #endif")
	}

	if !changed {
		return code, false, nil
	}

	return builder.String(), true, nil
}

func evaluateCondition(condition string, vars map[string]any) bool {
	expression, err := govaluate.NewEvaluableExpression(condition)
	if err != nil {
		return false
	}

	result, err := expression.Evaluate(vars)
	if err != nil {
		return false
	}

	value, ok := result.(bool)
	if ok {
		return value
	}

	switch typed := result.(type) {
	case string:
		return typed != ""
	case float64:
		return typed != 0
	case int:
		return typed != 0
	default:
		return typed != nil
	}
}

func matchFile(filePath string, includes []string, excludes []string, cwd string) bool {
	normalized := normalizeFilePath(filePath)
	if normalized == "" || strings.Contains(normalized, "/node_modules/") {
		return false
	}

	candidates := []string{
		normalized,
		path.Base(normalized),
	}

	normalizedCwd := normalizeFilePath(cwd)
	if suffix, ok := strings.CutPrefix(normalized, normalizedCwd+"/"); ok {
		candidates = append(candidates, suffix)
	}

	if len(includes) == 0 {
		includes = []string{"**/*"}
	}

	return anyMatch(includes, candidates) && !anyMatch(excludes, candidates)
}

func anyMatch(patterns []string, candidates []string) bool {
	if len(patterns) == 0 {
		return false
	}

	for _, pattern := range patterns {
		normalizedPattern := normalizeFilePath(pattern)
		for _, candidate := range candidates {
			matched, err := doublestar.Match(normalizedPattern, candidate)
			if err == nil && matched {
				return true
			}
		}
	}

	return false
}

func normalizeFilePath(filePath string) string {
	return strings.ReplaceAll(filepath.ToSlash(filePath), "\\", "/")
}

func allMatched(stack []stackState) bool {
	for _, state := range stack {
		if !state.matched {
			return false
		}
	}

	return true
}

func inferLoader(filePath string) api.Loader {
	switch strings.ToLower(path.Ext(filePath)) {
	case ".ts":
		return api.LoaderTS
	case ".tsx":
		return api.LoaderTSX
	case ".jsx":
		return api.LoaderJSX
	case ".css":
		return api.LoaderCSS
	case ".json":
		return api.LoaderJSON
	default:
		return api.LoaderJS
	}
}
