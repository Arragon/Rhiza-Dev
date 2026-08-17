# Architecture Gates

This directory contains versioned, reviewable inputs and evidence for the 0818
architecture gates.  `G0` freezes the Legacy implementation; it does not
assert that the target event-driven architecture exists.

Run `pnpm verify:g0` to run the mapped backend, UI Retry, and Stop E2E
characterization tests, then validate schemas and local `$ref` closure, fixture
hygiene, snapshots, canonical determinism, and five no-network benchmarks
(workspace query/command, graph read, context plan, stream commit). The runner intentionally does not overwrite
tracked evidence.  A release owner performs the two-commit evidence flow:

1. Commit changed fixtures, API/DB snapshots, registry digests, and tests. This
   commit is the exact evaluation tree recorded by the evidence manifest.
2. Create the annotated `pre-0815-engineering-baseline` tag at `b29d94f`.
3. Run `pnpm g0:evidence`; it reruns the mapped characterization tests, verifies
   the tag object and peeled commit, records five 20-warm-up/200-sample metrics,
   validates the manifest with JSON Schema, and writes `G0/evidence.json`.
4. Review and commit `G0/evidence.json` separately.

`environment-profile.json` is a CI profile. `performance-profile.json` is a
versioned 300-node workload recipe: it names a registered workspace fixture as
its base and is checksummed in evidence. The benchmark uses one persistent HTTP
server and records all 200 samples per metric; failures, HTTP timeouts, and
connection drops make the run fail rather than stopping at the first error.
Fixture registry provenance is
always `synthetic`; the runner rejects secrets, bearer/sk/cloud keys, PEM,
absolute/file paths (including private, tmp, etc, UNC, and home paths),
traversal, unregistered fixtures, and oversized content.
Locally generated evidence records the actual Node, OS, CPU, memory, and store
adapter alongside the declared CI profile. The committed local result is
supplemental: `G0/ci-performance-baseline.json` is the canonical Linux
performance baseline, attested to the GitHub Actions run and artifact that
produced it. CI additionally runs `pnpm g0:observe`, which writes a
schema-validated, untracked observation
to `$RUNNER_TEMP/g0-evidence.json` and uploads it as an artifact. It records
the checked-out SHA, GitHub Actions provenance, observed environment, metrics,
and checksums without replacing the archived baseline evidence.

On ordinary verification, the baseline tag must exist as an annotated tag and
peel to `b29d94f`. The archived evidence file is required: its recorded commit
must exist as a Git commit and be an ancestor of `HEAD`. It also validates the
attested CI baseline's raw-file SHA-256, GitHub Actions push provenance and
ancestor commit, declared environment profile, metric counts, and input
checksums. Verification recomputes every fixture, snapshot, and
performance-profile checksum, resolves every artifact reference, and retains
20 warm-ups, 200 samples, and zero recorded errors. Raw latency values are
observational and may differ between environments.
