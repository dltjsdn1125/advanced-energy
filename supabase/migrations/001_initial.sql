-- ============================================================
-- Advanced Energy — Initial Schema
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor)
-- ============================================================

-- ── user_settings ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.user_settings (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    openai_key       TEXT    NOT NULL DEFAULT '',
    telegram_token   TEXT    NOT NULL DEFAULT '',
    telegram_chat_id TEXT    NOT NULL DEFAULT '',
    daily_start_time TEXT    NOT NULL DEFAULT '09:00',
    daily_end_time   TEXT    NOT NULL DEFAULT '18:00',
    imap_host        TEXT    NOT NULL DEFAULT '',
    imap_port        TEXT    NOT NULL DEFAULT '993',
    imap_ssl         BOOLEAN NOT NULL DEFAULT TRUE,
    imap_user        TEXT    NOT NULL DEFAULT '',
    imap_pass        TEXT    NOT NULL DEFAULT '',
    smtp_host        TEXT    NOT NULL DEFAULT '',
    smtp_port        TEXT    NOT NULL DEFAULT '587',
    smtp_ssl         BOOLEAN NOT NULL DEFAULT TRUE,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id)
);

-- ── reports ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.reports (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    period      TEXT NOT NULL,   -- daily | weekly | monthly | pattern | tasks
    title       TEXT,
    content     TEXT NOT NULL,
    email_count INTEGER NOT NULL DEFAULT 0,
    share_token TEXT UNIQUE,
    is_shared   BOOLEAN NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── auto-update updated_at ───────────────────────────────────
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_user_settings_updated_at ON public.user_settings;
CREATE TRIGGER trg_user_settings_updated_at
    BEFORE UPDATE ON public.user_settings
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── Row Level Security ───────────────────────────────────────
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports       ENABLE ROW LEVEL SECURITY;

-- user_settings: 본인 행만 CRUD
CREATE POLICY "own settings" ON public.user_settings
    FOR ALL USING (auth.uid() = user_id);

-- reports: 본인 행 CRUD
CREATE POLICY "own reports" ON public.reports
    FOR ALL USING (auth.uid() = user_id);

-- reports: 공유된 레포트는 누구나 읽기 가능
CREATE POLICY "read shared reports" ON public.reports
    FOR SELECT USING (is_shared = TRUE);

-- ── Indexes ──────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_reports_user_id    ON public.reports (user_id);
CREATE INDEX IF NOT EXISTS idx_reports_share_token ON public.reports (share_token) WHERE share_token IS NOT NULL;
