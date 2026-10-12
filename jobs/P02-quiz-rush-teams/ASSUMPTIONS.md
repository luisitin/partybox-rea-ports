# P02 assumptions

- The old blocker was the absence of any public P01 implementation. P01 is
  now DONE with PR2 and public branch1c8d264. It is still unmerged; P02 reuses
  that branch and will stack its PR on it instead of building another engine.
- Owner10-11 official naming renames the inherited workshop folder/id/name
  to kahoot/Kahoot!. Existing P01 job/branch paths remain stable.
- Existing Lightning Round already incorporated P01 donor cues. Core gets
  opt-in teams/room vote under its existing card; injected classic remains
  unchanged, including wager, content, minigame and language behavior.
- Team mode uses personal devices and mean points. Fixed balanced teams are
  seeded. Each question excludes disconnected, unanswered members from its
  mean; an accepted departing member still contributes. This explicit local
  rule protects teammates from absent seats and avoids raw-sum size bias.
- Room vote is one cooperative group. It elects a plurality answer, breaks
  ties with seeded randomness, and shares the resulting score. It is an
  original adaptation, distinct from native unscored polls.
- Discussion defaults to5s but respects the SDK reading floor. Speed timing
  starts only when the answer window opens. The15-minute manifest estimate
  covers the additional discussion beats at maximum settings.
- Original interactive team play was not performed without a room PIN or
  captain account; paired published sources/screenshots reconstruct the flow.
- Custom files are validated/converted before bundling; rebuild/restart the
  host and select Custom local pack. The SDK InitContext has no content field,
  so no runtime content-slot API is assumed. Game code performs no runtime
  filesystem/network calls. Unknown custom facts use seeded guesses rather
  than hidden keys.
