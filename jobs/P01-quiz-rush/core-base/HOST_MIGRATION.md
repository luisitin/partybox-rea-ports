# Required core handoff - not applied

The public plugin implementation now lives in `games/kahoot`: it replaces the standalone
`games/quiz-rush` and upgrades Lightning Round with completed additive wager/classic modes.
Final upgraded checks, evidence review, CI and KEEP GOING completion remain pending. The
instructions below concern the owner's separate core host; no core migration has been applied.

Use one selectable canonical kahoot registration. Legacy compatibility belongs at input/persistence boundaries, not in a second game entry.

- Regenerate packages/{server,client}/src/games.generated.ts via scripts/gen-registry.ts after the real folder/manifest rename. Catalog data is manifest-derived.
- Update client/src/intro/film/films.ts FILM_GAMES/SEAT_GAMES and client/src/tv/HostWorld.tsx. Adapt client/public/films/lightning-round/index.html, its pieces and films/manifest.json. scripts/import-films.ts derives both origin/cine/<id> and cinematics/<id>; redirect both deliberately.
- Party World dynamically selects registered minigames; preserve the manifest minigame block. Migrate party-world/fixtures/{bonus,done}.json plus legacy seen[], mini.game and nested mini.mg IDs.
- engine/src/lookup.ts has exact lookup and no alias layer. Normalize selectedGameId, lastGame.gameId, settingsByGame, tonight history, tuned-settings.json and manual saves without duplicate selectable registration.
- server/src/room-store.ts compares registry IDs/versions. Rename changes its build fingerprint; current restore policy returns active rooms to lobby. Seamless active-room conversion is not implemented.
- Core runner.ts supplies canSeeTv and ctx.presence; engine/presence.ts and engine/views.ts stamp live phoneOnly/contentLang. client/controller/Playing.tsx chooses spectator/PhoneStage screens and supplies PhoneOnlyProvider. Those host integrations are absent publicly. The public controller now implements the question/public stage for phone-only, remote, spectator and departed seats in both modes. Wire the core host to preserve that routing, including its ownSpectatorScreen mechanism where required; public GamePhoneModule lacks that optional property.
- All licensed art/music remain excluded here. If restored privately, keep their source licenses. Original shared music plan: mining-by-moonlight, volume 0.07, chain mode, with reveal/wager ducking. The public shared module uses SDK synthesized beds and has no file-music plan.
- Art URLs derive from manifest ID. Speech warming enumerates registry; cache files use reading keys. Changed recap/reading prefixes may cause cache misses. No speech assets are copied.
- Update server catalog/category tests, sim/lightning-film-results.test.ts, scripts/check-content-pack-duplicates.ts and e2e direct imports/fixture paths; capture/probe/theme-baseline callers also retain old IDs.
- Update docs/games/catalog.md, docs/games/lightning-round.md, docs/DEPENDENCIES.md, docs/TESTING.md and docs/sdk/minigame.md. Preserve historical attribution/ADR references.
- Public integration has replaced games/quiz-rush with the canonical derivative and additive classic mode, and updated P01 CI/job documentation. Its wager default, bilingual libraries, scoring cap, stakes, recap, awards and minigame are retained; classic has three authored packs, stamped answers and an occupied-tier podium. Final evidence/checks, CI and KEEP GOING completion remain pending; historical standalone results do not prove this upgrade. Core registry, routing and persistence changes listed above remain unapplied.
