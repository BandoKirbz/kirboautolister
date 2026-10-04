# Integration verify report

Use this shape in the user-facing reply. Lead with overall status, then failures with a working path.

```markdown
## Status
Pass / Fail — <passed> passed, <failed> failed, <skipped> skipped. Environment: Sandbox or Production.

## Working
- <check>: <one-line evidence, no secrets>

## Failed — fix these
### <check name>
- **Impact:** what the customer hits
- **Evidence:** script detail
- **Working path:** the concrete fix (reconnect, env var, code patch). If you already shipped a patch, say so and show the re-run result.

## Skipped
- <check>: why (usually "reconnect eBay" or "S3 not configured")

## Vendor drift
- Checked release notes? Yes/No — what changed, what we did
- `docs/ebay-api-reference.md` last-verified dates updated? Yes/No

## Follow-up the user must do
- e.g. Reconnect eBay at /dashboard/platforms
- e.g. Add AWS_* to .env.local
```
