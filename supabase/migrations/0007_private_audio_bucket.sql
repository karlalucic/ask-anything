-- Final audio files can contain private user-generated content. Keep the
-- bucket private and serve playback/download through short-lived signed URLs.

update storage.buckets
set public = false
where id = 'audio';
