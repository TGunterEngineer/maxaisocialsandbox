ALTER TABLE public.reviews REPLICA IDENTITY FULL;
ALTER TABLE public.feedback_responses REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.reviews;
ALTER PUBLICATION supabase_realtime ADD TABLE public.feedback_responses;