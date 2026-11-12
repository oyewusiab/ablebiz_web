-- ==============================================================================
-- ABLEBIZ SUITE — PHASES 15, 16, 17, 18 & 19 ROLLBACK SCRIPT DIRECTORY
-- File: implementation/ROLLBACK_PHASES_15_16_17_18_19.sql
-- ==============================================================================
-- IMPORTANT OPERATIONAL NOTICE:
-- Two distinct rollback scripts are provided depending on operational stage:
--
-- 1. PRE-PRODUCTION TEARDOWN (Pre-operational sandbox only):
--    File: implementation/ROLLBACK_PRE_PRODUCTION_PHASES_15_16_17_18_19.sql
--    Completely drops Phase 15–19 tables and columns. DO NOT RUN IN PRODUCTION.
--
-- 2. POST-PRODUCTION SAFE OPERATIONAL ROLLBACK (Production / Live stage):
--    File: implementation/ROLLBACK_POST_PRODUCTION_SAFE_PHASES_15_16_17_18_19.sql
--    Freezes allocations, deactivates escalation rules and service bundles,
--    and preserves 100% of audit logs, allocations, and financial records.
-- ==============================================================================

-- If running this script directly in a pre-production testing environment,
-- the following block performs the pre-production schema teardown:

\ir ROLLBACK_PRE_PRODUCTION_PHASES_15_16_17_18_19.sql
