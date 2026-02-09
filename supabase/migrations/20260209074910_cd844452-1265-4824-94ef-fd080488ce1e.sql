-- Refresh the PostgREST schema cache to make newly added restaurants immediately discoverable
NOTIFY pgrst, 'reload schema';