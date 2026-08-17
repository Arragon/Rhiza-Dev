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

`environment-profile.json` is a CI profile. Fixture registry provenance is
always `synthetic`; the runner rejects secrets, bearer/sk/cloud keys, PEM,
absolute/file paths, traversal, unregistered fixtures, and oversized content.
Locally generated evidence records the actual Node, OS, CPU, memory, and store
adapter alongside the declared CI profile. The committed local result remains
supplemental until the same `verify:g0` command is green in CI.
