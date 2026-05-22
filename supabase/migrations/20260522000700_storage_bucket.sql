-- =============================================================================
-- LSODance — Private Student Photos Storage Bucket (STUD-01, T-02-04, T-02-06)
-- =============================================================================
--
-- CHILDREN'S DATA: Photos are of minors (ages ~3-18). The bucket MUST be
-- private with organization-scoped RLS. No public URLs. Access via signed
-- URLs with 1-hour expiry only.
--
-- Upload path convention: {organization_id}/{student_id}/{timestamp}.jpg
-- This embeds org context in the path so RLS can enforce isolation by
-- checking the first folder segment matches the JWT's organization_id.
--
-- File limits: 2MB max, image/jpeg + image/png + image/webp only.
-- =============================================================================


-- ---------------------------------------------------------------------------
-- Create the private bucket
-- ---------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'student-photos',
    'student-photos',
    false,
    2097152,  -- 2MB
    ARRAY['image/jpeg', 'image/png', 'image/webp']
);


-- ---------------------------------------------------------------------------
-- RLS policies — organization-scoped access for authenticated staff
--
-- Uses (storage.foldername(name))[1] to extract the first path segment
-- (organization_id) and compares it to the JWT's app_metadata.organization_id.
--
-- This ensures:
-- - Staff can only upload/view/delete photos within their own organization
-- - Cross-org photo access is impossible
-- - When parents get accounts (Phase 4), they inherit the same restriction
-- ---------------------------------------------------------------------------

-- Upload: staff can upload student photos to their org folder
CREATE POLICY "Staff can upload student photos to their org"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'student-photos'
    AND (storage.foldername(name))[1] = (
        SELECT (auth.jwt() -> 'app_metadata' ->> 'organization_id')
    )
);

-- View: staff can view student photos in their org folder
CREATE POLICY "Staff can view student photos in their org"
ON storage.objects
FOR SELECT
TO authenticated
USING (
    bucket_id = 'student-photos'
    AND (storage.foldername(name))[1] = (
        SELECT (auth.jwt() -> 'app_metadata' ->> 'organization_id')
    )
);

-- Delete: staff can delete student photos in their org folder
CREATE POLICY "Staff can delete student photos in their org"
ON storage.objects
FOR DELETE
TO authenticated
USING (
    bucket_id = 'student-photos'
    AND (storage.foldername(name))[1] = (
        SELECT (auth.jwt() -> 'app_metadata' ->> 'organization_id')
    )
);
