Performance validation for the September 5, 2026 review fixes.

Baseline: commit `3650694` (all correctness fixes, before performance changes). Measurements use Windows, Node 24.17.0, three warmups, seven measured rounds, and explicit GC between samples. Pool startup uses five measured rounds. Timings are medians; raw samples are retained in [validation/performance-before.json](validation/performance-before.json).

Run from the repository root after `yarn dist`:

```powershell
$env:BENCH_CASE = 'cache-churn'
node --expose-gc benchmark/review.mjs
```

Other cases are `cache-size` and `pool-startup`. Omit `BENCH_CASE` to run all cases. Set `BENCH_DIST` to the directory containing another revision's compiled modules to compare revisions with the same benchmark script. Do not compare runs performed concurrently. Run `yarn benchmark` for the broader existing utility workloads.

| Change and workload | Before (ms) | After (ms) | Elapsed-time reduction |
| --- | ---: | ---: | ---: |
| Explicit cache recency links, 40,000 churn scale | 95.50 | 25.78 | 73.0% |
| Explicit cache recency links, 80,000 churn scale | 370.95 | 41.38 | 88.8% |
| Skip premature expiry scans, 1,000 size reads / 50,000 nonexpiring entries | 512.28 | 0.107 | >99.9% |

The churn benchmark uses the same fill/get/has/replace pattern as the existing cache benchmark and verifies the expected values and capacity. Raw samples: [cache-churn-after.json](validation/cache-churn-after.json). Explicit recency links remove repeated searches for the oldest Map entry. A deterministic 2,000-operation reference-model test verifies order and values across replacements, reads, deletes, and clears; a separate test covers reentrant eviction callbacks. Extra node links increase per-entry memory usage; Map iteration remains the source of public iteration behavior.

Each accepted optimization must exceed 10% on its representative workload and preserve the correctness tests. These measurements characterize this machine and runtime; they do not establish browser or cross-platform speedups.

Expiry tracking skips scans before any entry can expire, including per-entry TTL overrides. Removed or replaced deadlines may conservatively trigger one unnecessary scan; they cannot hide an earlier expiration. Regression tests cover deadlines after replacement, deletion, clear, and throwing eviction callbacks. The same benchmark also tests live 60-second TTL entries, so the fast path is verified for both expiring and nonexpiring caches. Raw samples: [cache-size-after.json](validation/cache-size-after.json). Very short optimized timings are sensitive to measurement overhead; the large absolute reduction from scanning every entry is the relevant result.
