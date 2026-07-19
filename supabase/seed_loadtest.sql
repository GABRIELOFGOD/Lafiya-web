-- Seed script for load testing get_emergency_card
-- Adjust the variable NUM_ROWS to the desired dataset size
\set NUM_ROWS 1000

DO $$
DECLARE
  i integer := 1;
BEGIN
  FOR i IN 1..:NUM_ROWS LOOP
    INSERT INTO public.profiles (
      id,
      name,
      date_of_birth,
      photo_url,
      blood_group,
      genotype,
      allergies,
      medications,
      chronic_conditions,
      emergency_contacts,
      language,
      card_public_id
    ) VALUES (
      gen_random_uuid(),
      'Test User ' || i,
      NULL,
      NULL,
      'A+',
      'AA',
      ARRAY[]::text[],
      ARRAY[]::text[],
      ARRAY[]::text[],
      '{}'::jsonb,
      'en',
      gen_random_uuid()
    );
  END LOOP;
END $$;

-- Export generated card IDs for the k6 script (optional helper)
\copy (SELECT card_public_id FROM public.profiles) TO PROGRAM 'cat > loadtest/card_ids.txt';
