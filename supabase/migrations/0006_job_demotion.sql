-- Tracks when a job entered 'demoted' status, so the hourly expiry job
-- can auto-pause it after 14 days without the employer's response rate
-- recovering (§6.4).
alter table jobs add column demoted_at timestamptz;
