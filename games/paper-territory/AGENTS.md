# Paper Territory

Read README.md as the rules. Only SDK imports in server code; all movement and collision decisions are pure and use event time. Never change slot numbers when a player leaves. World cells use four-neighbour adjacency; home ownership is protected. Judge every simultaneous tick against one snapshot, then cuts and crashes, then flood-fill captures. Same-tick contested claims become neutral.

Run only this game's tests. Keep fixtures, research, media and verification records current in jobs/P07-paper-territory. Bots inspect public land/trails only; do not cache mutable plans outside state. UI colours use PartyBox tokens and numbered markers. A stage phone must not refer to a TV.
