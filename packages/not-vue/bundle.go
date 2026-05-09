package main

import (
	"context"
	"errors"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"os/exec"
	"os/signal"
	"path/filepath"
	"runtime"
	"strings"
	"syscall"
	"time"
)

const (
	defaultPort         = "3000"
	templatePlaceholder = "<!-- TEMPLATE -->"
)

type bundleConfig struct {
	rootDir          string
	templateHTMLPath string
	indexHTMLPath    string
	vendorTSPath     string
	indexTSPath      string
	vendorJSPath     string
	indexJSPath      string
}

func main() {
	log.SetFlags(0)

	if err := run(os.Args[1:]); err != nil {
		log.Fatal(err)
	}
}

func run(args []string) error {
	mode := "dev"
	if len(args) > 0 {
		mode = args[0]
	}

	config, err := newBundleConfig()
	if err != nil {
		return err
	}

	switch mode {
	case "dev":
		return runDev(config)
	case "build":
		return runBuild(config)
	default:
		return fmt.Errorf("unknown mode %q, expected one of: dev, build", mode)
	}
}

func newBundleConfig() (bundleConfig, error) {
	_, filePath, _, ok := runtime.Caller(0)
	if !ok {
		return bundleConfig{}, errors.New("resolve bundle.go location: runtime caller unavailable")
	}
	rootDir := filepath.Dir(filePath)

	return bundleConfig{
		rootDir:          rootDir,
		templateHTMLPath: filepath.Join(rootDir, "template.html"),
		indexHTMLPath:    filepath.Join(rootDir, "index.html"),
		vendorTSPath:     filepath.Join(rootDir, "vendor.ts"),
		indexTSPath:      filepath.Join(rootDir, "index.ts"),
		vendorJSPath:     filepath.Join(rootDir, "vendor.js"),
		indexJSPath:      filepath.Join(rootDir, "index.js"),
	}, nil
}

func runBuild(config bundleConfig) error {
	cleanup, err := compileTypeScript(config, false)
	if err != nil {
		return err
	}
	defer cleanup()

	log.Printf("build complete: %s, %s", config.indexJSPath, config.vendorJSPath)
	return nil
}

func runDev(config bundleConfig) error {
	cleanup, err := compileTypeScript(config, true)
	if err != nil {
		return err
	}
	defer cleanup()

	mux := http.NewServeMux()
	fileServer := http.FileServer(http.Dir(config.rootDir))
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/" {
			http.ServeFile(w, r, config.indexHTMLPath)
			return
		}
		fileServer.ServeHTTP(w, r)
	})

	server := &http.Server{
		Addr:              ":" + defaultPort,
		Handler:           mux,
		ReadHeaderTimeout: 5 * time.Second,
	}

	errCh := make(chan error, 1)
	go func() {
		log.Printf("dev server running at http://localhost:%s", defaultPort)
		if serveErr := server.ListenAndServe(); serveErr != nil && !errors.Is(serveErr, http.ErrServerClosed) {
			errCh <- serveErr
		}
		close(errCh)
	}()

	signalCtx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	select {
	case <-signalCtx.Done():
		log.Println("shutting down dev server...")
	case serveErr := <-errCh:
		if serveErr != nil {
			return fmt.Errorf("start dev server: %w", serveErr)
		}
		return nil
	}

	shutdownCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := server.Shutdown(shutdownCtx); err != nil {
		return fmt.Errorf("shutdown dev server: %w", err)
	}

	return nil
}

func compileTypeScript(config bundleConfig, removeOutputOnCleanup bool) (func(), error) {
	generatedEntryPath, cleanupTemp, err := prepareGeneratedSources(config)
	if err != nil {
		return nil, err
	}

	var cleanupFns []func()
	cleanupFns = append(cleanupFns, cleanupTemp)

	tempOutputDir, err := os.MkdirTemp("", "proxy-tsc-out-*")
	if err != nil {
		runCleanup(cleanupFns)
		return nil, fmt.Errorf("create temp output dir: %w", err)
	}
	cleanupFns = append(cleanupFns, func() {
		_ = os.RemoveAll(tempOutputDir)
	})

	if err := runTSC(generatedEntryPath, tempOutputDir); err != nil {
		runCleanup(cleanupFns)
		return nil, err
	}

	compiledIndexJSPath := filepath.Join(tempOutputDir, "index.js")
	if _, err := os.Stat(compiledIndexJSPath); err != nil {
		runCleanup(cleanupFns)
		return nil, fmt.Errorf("compiled output missing: %w", err)
	}

	compiledVendorJSPath := filepath.Join(tempOutputDir, "vendor.js")
	if _, err := os.Stat(compiledVendorJSPath); err != nil {
		runCleanup(cleanupFns)
		return nil, fmt.Errorf("compiled output missing: %w", err)
	}

	if err := copyFile(compiledIndexJSPath, config.indexJSPath); err != nil {
		runCleanup(cleanupFns)
		return nil, fmt.Errorf("write %s: %w", config.indexJSPath, err)
	}

	if err := copyFile(compiledVendorJSPath, config.vendorJSPath); err != nil {
		runCleanup(cleanupFns)
		return nil, fmt.Errorf("write %s: %w", config.vendorJSPath, err)
	}

	if removeOutputOnCleanup {
		cleanupFns = append(cleanupFns, func() {
			_ = os.Remove(config.indexJSPath)
			_ = os.Remove(config.vendorJSPath)
		})
	}

	return func() {
		runCleanup(cleanupFns)
	}, nil
}

func prepareGeneratedSources(config bundleConfig) (string, func(), error) {
	templateContent, err := os.ReadFile(config.templateHTMLPath)
	if err != nil {
		return "", nil, fmt.Errorf("read template.html: %w", err)
	}

	vendorTSContent, err := os.ReadFile(config.vendorTSPath)
	if err != nil {
		return "", nil, fmt.Errorf("read vendor.ts: %w", err)
	}

	indexTSContent, err := os.ReadFile(config.indexTSPath)
	if err != nil {
		return "", nil, fmt.Errorf("read index.ts: %w", err)
	}

	indexTSString := string(indexTSContent)
	if !strings.Contains(indexTSString, templatePlaceholder) {
		return "", nil, fmt.Errorf("placeholder %q not found in index.ts", templatePlaceholder)
	}

	replaced := strings.Replace(indexTSString, templatePlaceholder, string(templateContent), 1)

	tempDir, err := os.MkdirTemp("", "proxy-ts-src-*")
	if err != nil {
		return "", nil, fmt.Errorf("create temp source dir: %w", err)
	}

	generatedIndexPath := filepath.Join(tempDir, "index.ts")
	if err := os.WriteFile(generatedIndexPath, []byte(replaced), 0o644); err != nil {
		_ = os.RemoveAll(tempDir)
		return "", nil, fmt.Errorf("write generated index.ts: %w", err)
	}

	generatedVendorPath := filepath.Join(tempDir, "vendor.ts")
	if err := os.WriteFile(generatedVendorPath, vendorTSContent, 0o644); err != nil {
		_ = os.RemoveAll(tempDir)
		return "", nil, fmt.Errorf("write generated vendor.ts: %w", err)
	}

	return generatedIndexPath, func() {
		_ = os.RemoveAll(tempDir)
	}, nil
}

func runTSC(entryPath, outDir string) error {
	command, args := resolveTSCCommand(entryPath, outDir)

	cmd := exec.Command(command, args...)
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr

	if err := cmd.Run(); err != nil {
		return fmt.Errorf("run typescript compiler: %w", err)
	}

	return nil
}

func resolveTSCCommand(entryPath, outDir string) (string, []string) {
	baseArgs := []string{
		"--target", "ESNext",
		"--module", "ESNext",
		"--moduleResolution", "node",
		"--lib", "ESNext,DOM",
		"--strict",
		"--skipLibCheck",
		"--pretty", "false",
		"--declaration", "false",
		"--sourceMap", "false",
		"--removeComments", "false",
		"--outDir", outDir,
		entryPath,
	}

	if _, err := exec.LookPath("tsc"); err == nil {
		return "tsc", baseArgs
	}

	return "npx", append([]string{"--yes", "tsc"}, baseArgs...)
}

func copyFile(srcPath, dstPath string) error {
	src, err := os.Open(srcPath)
	if err != nil {
		return err
	}
	defer src.Close()

	dst, err := os.Create(dstPath)
	if err != nil {
		return err
	}
	defer func() {
		_ = dst.Close()
	}()

	if _, err := io.Copy(dst, src); err != nil {
		return err
	}

	return dst.Close()
}

func runCleanup(cleanups []func()) {
	for i := len(cleanups) - 1; i >= 0; i-- {
		if cleanups[i] != nil {
			cleanups[i]()
		}
	}
}
