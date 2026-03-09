/*
  # Sync role to both app_metadata and user_metadata

  1. Changes
    - Update `sync_role_to_app_metadata()` to also sync role to `raw_user_meta_data`
    - This ensures `user_metadata.role` in the JWT is always current
    - Both metadata fields are now kept in sync with `profiles.role`

  2. Data fix
    - Sync all existing profiles role to user_metadata
*/

CREATE OR REPLACE FUNCTION sync_role_to_app_metadata()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE auth.users
  SET 
    raw_app_meta_data = raw_app_meta_data || jsonb_build_object('role', NEW.role),
    raw_user_meta_data = raw_user_meta_data || jsonb_build_object('role', NEW.role)
  WHERE id = NEW.id;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  user_role text;
  user_name text;
BEGIN
  user_role := COALESCE(NEW.raw_user_meta_data->>'role', 'student');
  user_name := COALESCE(NEW.raw_user_meta_data->>'full_name', '');

  INSERT INTO public.profiles (id, role, full_name)
  VALUES (NEW.id, user_role, user_name);

  UPDATE auth.users
  SET 
    raw_app_meta_data = raw_app_meta_data || jsonb_build_object('role', user_role),
    raw_user_meta_data = raw_user_meta_data || jsonb_build_object('role', user_role)
  WHERE id = NEW.id;

  RETURN NEW;
END;
$$;

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT id, role FROM public.profiles
  LOOP
    UPDATE auth.users
    SET 
      raw_app_meta_data = raw_app_meta_data || jsonb_build_object('role', r.role),
      raw_user_meta_data = raw_user_meta_data || jsonb_build_object('role', r.role)
    WHERE id = r.id;
  END LOOP;
END;
$$;
