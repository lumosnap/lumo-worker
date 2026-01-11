-- Seed default plans
INSERT INTO plans (name, display_name, price_monthly, image_limit, description, is_active)
VALUES
  ('trial', 'Trial', '0.00', 500, 'Free trial plan with limited uploads', true),
  ('starter', 'Starter', '9.99', 50000, 'For hobbyists and small projects', true)
ON CONFLICT (name) DO NOTHING;
