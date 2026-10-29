# phonics-docs-1 summary (2026-10-24) — DONE

## Wrote
- `content/phonics/p01.json` … `p24.json` (validated: `npx tsx scripts/content-validate.ts --allow-missing` → ok).
  Plan: units u03–u26 map in order to p01–p24 (content-a/content-b set the unit `phonics` field).
- `docs/README.md` (index incl. files other agents will write: modules/{storage,speech,main-process,ui,lesson,review}.md, decisions/, dev-setup.md, progress.md)
- `docs/01-learning-method.md` (constants copied from planner.ts / streak.ts / exercise.ts / srs.ts / settings.ts / speechMatch.ts as of today — re-check if those change)
- `docs/content/curriculum.md` (13 weeks; phase-2 unit titles are the coordinator's plan, may drift as content-b writes them)
- `docs/content/authoring-guide.md`
- `docs/user-guide-zh.md`

## Notes for others
- User guide describes UI buttons: ▶, 🐢, 🎤 (auto-stop), ▶▶ (original then mine), 💡 (staged hints: first word → 谐音 → answer), a fallback "我说对了 / 显示答案" when recognition fails, 😊/🤔/😅 self-rating, "导出诊断包" in settings, "我的进步" page with challenge recordings comparison. **renderer agent: match these labels or tell phonics-docs/coordinator to update the guide.**
- Phonics example words / pair words are NOT in the lexicon (by design; compile.ts treats them as plain sentences).
