# STORY knowledge projection boundary

This module keeps Phase 2 knowledge serialization reference-only and fail-closed.

Audience, player, character, and agent contexts receive only explicitly permitted knowledge reference IDs. World-truth and creator-hidden partitions are never inherited by broader contexts. Character and agent contexts are subject-scoped, and unsupported payload fields are rejected so hidden prose, prompts, or secret bodies cannot hitchhike through this boundary.

This is a module-owned STORY boundary. It does not create a second knowledge store, Context Engine, agent runtime, or canon system.
