-- =============================================================================
-- Parent Auth Support (Plan 04-03, T-04-03-01)
--
-- Parents are NOT staff. They authenticate via magic link and get a 'parent'
-- role injected into their JWT via the custom_access_token_hook. The hook
-- checks the families table for a matching parent_user_id and injects:
--   role = 'parent'
--   organization_id = families.organization_id
--   family_id = families.id
--
-- This lets all parent API routes scope to family_id from the JWT without
-- trusting any request parameter.
-- =============================================================================

-- 1. Add parent_user_id column to families table
-- Links a Supabase Auth user to a family record. One auth user = one family.
ALTER TABLE families
  ADD COLUMN parent_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- Index for the hook lookup (called on every JWT mint)
CREATE INDEX idx_families_parent_user_id ON families (parent_user_id) WHERE parent_user_id IS NOT NULL;

-- 2. Grant supabase_auth_admin SELECT on families so the hook can read it
-- (Same pattern as the existing grant for public.staff)
GRANT SELECT ON public.families TO supabase_auth_admin;

-- 3. Update custom_access_token_hook to also check families table
-- If the user is a staff member, they get staff role (existing behavior).
-- If not staff but linked as a parent, they get 'parent' role + family_id.
-- Staff takes precedence -- if someone is both, they get the staff role.
CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  claims jsonb;
  staff_record record;
  family_record record;
BEGIN
  -- Start with the existing claims from the event
  claims := event -> 'claims';

  -- First, check if the user is a staff member (existing behavior, takes precedence)
  SELECT role, organization_id
  INTO staff_record
  FROM public.staff
  WHERE user_id = (event ->> 'user_id')::uuid
    AND active = true
  LIMIT 1;

  IF staff_record IS NOT NULL THEN
    -- Staff user: inject staff role + organization_id
    claims := jsonb_set(claims, '{app_metadata,role}', to_jsonb(staff_record.role::text));
    claims := jsonb_set(claims, '{app_metadata,organization_id}', to_jsonb(staff_record.organization_id::text));
    RETURN jsonb_set(event, '{claims}', claims);
  END IF;

  -- Not staff -- check if user is a parent (linked via families.parent_user_id)
  SELECT id, organization_id
  INTO family_record
  FROM public.families
  WHERE parent_user_id = (event ->> 'user_id')::uuid
  LIMIT 1;

  IF family_record IS NOT NULL THEN
    -- Parent user: inject 'parent' role + organization_id + family_id
    claims := jsonb_set(claims, '{app_metadata,role}', '"parent"'::jsonb);
    claims := jsonb_set(claims, '{app_metadata,organization_id}', to_jsonb(family_record.organization_id::text));
    claims := jsonb_set(claims, '{app_metadata,family_id}', to_jsonb(family_record.id::text));
  END IF;

  -- Return the modified event with updated claims
  RETURN jsonb_set(event, '{claims}', claims);
END;
$$;
