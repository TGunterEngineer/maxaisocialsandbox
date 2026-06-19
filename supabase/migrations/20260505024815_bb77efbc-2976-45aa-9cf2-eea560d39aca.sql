CREATE OR REPLACE FUNCTION public.get_org_analytics_summary(_org_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total int;
  v_sent int;
  v_responded int;
  v_routed_google int;
  v_routed_feedback int;
  v_avg_rating numeric;
  v_ratings_count int;
  v_rating_dist jsonb;
  v_reviews_total int;
  v_reviews_avg numeric;
  v_sentiment jsonb;
  v_recent_feedback jsonb;
BEGIN
  IF NOT public.is_org_member(auth.uid(), _org_id) THEN
    RAISE EXCEPTION 'Not a member of this organization';
  END IF;

  SELECT
    COUNT(*)::int,
    COUNT(*) FILTER (WHERE send_status = 'sent' OR sent_at IS NOT NULL)::int,
    COUNT(*) FILTER (WHERE rating_submitted_at IS NOT NULL)::int,
    COUNT(*) FILTER (WHERE routed_to = 'google')::int,
    COUNT(*) FILTER (WHERE routed_to = 'feedback')::int,
    COALESCE(ROUND(AVG(rating)::numeric, 1), 0),
    COUNT(*) FILTER (WHERE rating IS NOT NULL)::int
  INTO v_total, v_sent, v_responded, v_routed_google, v_routed_feedback, v_avg_rating, v_ratings_count
  FROM public.campaign_recipients
  WHERE organization_id = _org_id;

  SELECT jsonb_object_agg(star, cnt) INTO v_rating_dist
  FROM (
    SELECT s AS star, COALESCE(COUNT(cr.rating), 0)::int AS cnt
    FROM generate_series(1,5) s
    LEFT JOIN public.campaign_recipients cr
      ON cr.organization_id = _org_id AND cr.rating = s
    GROUP BY s
  ) t;

  SELECT
    COUNT(*)::int,
    COALESCE(ROUND(AVG(rating)::numeric, 1), 0)
  INTO v_reviews_total, v_reviews_avg
  FROM public.reviews
  WHERE organization_id = _org_id;

  SELECT jsonb_build_object(
    'positive', COUNT(*) FILTER (WHERE sentiment = 'positive')::int,
    'neutral',  COUNT(*) FILTER (WHERE sentiment = 'neutral')::int,
    'negative', COUNT(*) FILTER (WHERE sentiment = 'negative')::int,
    'unrated',  COUNT(*) FILTER (WHERE sentiment IS NULL)::int
  ) INTO v_sentiment
  FROM public.reviews
  WHERE organization_id = _org_id;

  SELECT COALESCE(jsonb_agg(row_to_json(r)), '[]'::jsonb) INTO v_recent_feedback
  FROM (
    SELECT id, rating, feedback, created_at
    FROM public.feedback_responses
    WHERE organization_id = _org_id
    ORDER BY created_at DESC
    LIMIT 5
  ) r;

  RETURN jsonb_build_object(
    'campaigns', jsonb_build_object(
      'total', v_total,
      'sent', v_sent,
      'responded', v_responded,
      'response_rate', CASE WHEN v_sent > 0 THEN ROUND((v_responded::numeric / v_sent) * 100)::int ELSE 0 END,
      'routed_google', v_routed_google,
      'routed_feedback', v_routed_feedback,
      'avg_rating', v_avg_rating,
      'ratings_count', v_ratings_count,
      'rating_distribution', COALESCE(v_rating_dist, '{}'::jsonb)
    ),
    'reviews', jsonb_build_object(
      'total', v_reviews_total,
      'avg_rating', v_reviews_avg,
      'sentiment', v_sentiment
    ),
    'feedback_total', (SELECT COUNT(*)::int FROM public.feedback_responses WHERE organization_id = _org_id),
    'recent_feedback', v_recent_feedback
  );
END;
$$;