#!/bin/bash
# Runs all tests and displays a summary of test counts per package

echo "Running tests..."
echo ""

# Run tests and capture output
OUTPUT=$(pnpm test --force 2>&1)

# Parse and display summary
echo "$OUTPUT" | grep -E "^(create-velox-app|@veloxts/[^:]+):test:.*(Test Files|Tests)" | \
  sed 's/\x1b\[[0-9;]*m//g' | \
  grep -E "\([0-9]+\)$" | \
  awk -F':test:' '
{
  pkg=$1
  line=$2
  gsub(/.*\(/, "", line)
  gsub(/\).*/, "", line)
  num=line+0

  if ($0 ~ /Test Files/) {
    files[pkg]=num
  } else if ($0 ~ /Tests /) {
    tests[pkg]=num
  }
}
END {
  total_tests=0
  total_files=0

  # Print header
  printf "%-25s %6s %8s\n", "Package", "Files", "Tests"
  printf "%-25s %6s %8s\n", "─────────────────────────", "──────", "────────"

  # Collect and sort package names
  n=0
  for (p in tests) {
    pkgs[n++] = p
  }

  # Simple bubble sort
  for (i=0; i<n-1; i++) {
    for (j=0; j<n-i-1; j++) {
      if (pkgs[j] > pkgs[j+1]) {
        tmp = pkgs[j]
        pkgs[j] = pkgs[j+1]
        pkgs[j+1] = tmp
      }
    }
  }

  # Print sorted packages
  for (i=0; i<n; i++) {
    p = pkgs[i]
    printf "%-25s %6d %8d\n", p, files[p], tests[p]
    total_tests += tests[p]
    total_files += files[p]
  }

  # Print total
  printf "%-25s %6s %8s\n", "─────────────────────────", "──────", "────────"
  printf "%-25s %6d %8d\n", "TOTAL", total_files, total_tests
}'
