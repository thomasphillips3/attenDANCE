-- =============================================================================
-- MANUAL STEP REQUIRED: After applying this migration, go to
-- Supabase Dashboard > Authentication > Hooks > Custom Access Token Hook
-- and select public.custom_access_token_hook
--
-- Without registering this hook in the dashboard, JWTs will NOT contain
-- role or organization_id in app_metadata, and all Fastify auth checks
-- and RLS policies will fail.
-- =============================================================================

-- =============================================================================
-- custom_access_token_hook
--
-- Called by Supabase Auth at JWT mint time (login + token refresh).
-- Reads the staff member's role and organization_id from the public.staff
-- table and injects them into app_metadata in the JWT claims.
--
-- app_metadata is server-writable only — users cannot tamper with these
-- values, unlike user_metadata. This is the correct pattern per:
-- https://supabase.com/docs/guides/auth/auth-hooks#custom-access-token-hook
-- =============================================================================

CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  claims jsonb;
  staff_record record;
BEGIN
  -- Fetch role and organization_id for this user from the staff table
  SELECT role, organization_id
  INTO staff_record
  FROM public.staff
  WHERE user_id = (event ->> 'user_id')::uuid
    AND active = true
  LIMIT 1;

  -- Start with the existing claims from the event
  claims := event -> 'claims';

  -- Inject role and organization_id into app_metadata if a staff record exists
  IF staff_record IS NOT NULL THEN
    claims := jsonb_set(claims, '{app_metadata,role}', to_jsonb(staff_record.role::text));
    claims := jsonb_set(claims, '{app_metadata,organization_id}', to_jsonb(staff_record.organization_id::text));
  END IF;

  -- Return the modified event with updated claims
  RETURN jsonb_set(event, '{claims}', claims);
END;
$$;

-- Grant execute permission to the Supabase Auth service
GRANT EXECUTE ON FUNCTION public.custom_access_token_hook TO supabase_auth_admin;

-- Revoke from public — only supabase_auth_admin should call this
REVOKE EXECUTE ON FUNCTION public.custom_access_token_hook FROM PUBLIC;
