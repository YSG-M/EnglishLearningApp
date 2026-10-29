# content-dd-1 — daily words + stories for u19–u22, w10–w11 (done)

Task brief: `.agent-wiki/tasks/daily-stories-content.md`. Finished, not a mid-task handoff.

## Done
| File | daily (12) | scenes changed (now ≥6 daily-life) | stories |
|---|---|---|---|
| u19-class-info | library read story swim exercise minute hour forget usually always sometimes wake | e06, e09 | "Amy 的星期天" / "新爸爸问第一节课" (Mr Lim, bm_lewis) |
| u20-bank-phone | wallet coins ATM password app screen save spend cheap data signal transfer | none (all 10 were already daily life) | "Amy 去银行和手机店" / "手机屏幕摔坏了" (Ken, bm_george) |
| u21-registration | party invite cake ticket festival relatives celebrate guests happy group flowers lantern | e02, e03, e04, e07 | "Amy 家的新年聚会" / "新学期报名" (Mrs Lee, bf_isabella) |
| u22-likes | music song sing dance hobby interesting boring love enjoy badminton karaoke sour | e01, e02 | "Amy 的星期六晚上" / "咖啡店里的邻居" (Auntie Lim, af_sarah) |
| content/weeks/w10.json | — | — | "Amy 忙碌的一周" / "老公的手机坏了" (Ben, am_michael) |
| content/weeks/w11.json | — | — | "Amy 和邻居过中秋" / "中心的新年活动" (Mr Tan, bm_george) |

- `content/lexicon/daily-d.json`: **47 new words**. Each u19–u22 daily word has an entry here, except `forget` (u19.d07), which lives in daily-c.json.
- Lexicon duplicates, settled with peers under the "earliest unit owns the entry" rule: `remember` went to u02 (my u19.d06 is now `minute`); `forget` stays in daily-c (dc agreed not to make it a daily word); `online` stays in daily-c (de removed their copy). I dropped `online` and use `signal` instead.
- Validation: `npx tsx scripts/content-validate.ts --only u22,w10,w11` reports "content ok", with no errors in my files.

## "not taught" warnings
- The validator still warns about words such as After, Oh, OK, dinner, shop, Great, or, Really, next. Every one of these is taught in an earlier unit's raw file. They only show up because u06, u10–u12 and u15–u18 don't parse yet (`daily`/`stories` still missing, other agents are mid-edit), so the compiler skips those units. They should go away once those units are finished; re-run `--only w11 --warnings` to confirm.
- I checked against the raw files of all earlier units (scratchpad script `storychk.py`, same logic as compile.ts: chunks + examples + daily + dialogue replies). Result: **0 new words in all 12 stories**.

## Unsure 谐音 (please review)
- transfer 穿斯佛 `tr-ǎn-s-fě`: the tr cluster is hard to show
- coins 扣因 `kò-yīn(z)`: the oi diphthong has no good hanzi
- interesting 因缀斯厅 `ín-trə-s-tíng`
- enjoy 因卓伊 `in-zhòi`: the j sound is approximated by zh
- karaoke 卡瑞欧奇 `kā-ri-ōu-ki`: Singaporeans often just say "卡拉OK" / KTV
- data 代他 `dèi-ta`: standard /deɪtə/; many Singaporeans say "dah-ta"
- group 鲁 `g-rū(p)`, signal 细呢 `sì(g)-nə(l)`, usually 优珠呃利 `yóu-zhu-ə-li`
- All my entries are yellow; none are red.

## For the coordinator
- In the u19 and u22 narratives and w11, the quoted lines don't say who is speaking in the English. The zh says who speaks (e.g. 老公说：…), because `says` is not in the lexicon. If you want "X says" in stories, add `says` to a lexicon.
- No code touched. No commit.
