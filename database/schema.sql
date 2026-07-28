-- New app database additions.
-- Run this on each legacy MySQL server after selecting the target database:
--   USE iclockdb;

CREATE TABLE IF NOT EXISTS employee_mobile_v2_face (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  employee_id INT NOT NULL,
  site_id INT NOT NULL,
  face_data LONGTEXT NOT NULL,
  template LONGTEXT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  UNIQUE KEY uq_employee_site (employee_id, site_id),
  KEY idx_site_updated (site_id, updated_at),
  KEY idx_employee (employee_id)
);

-- Template expiry cleanup.
-- Run this before adding the unique key if the legacy table has duplicate site rows.
-- Keeps the latest row per site_id by highest id.
SELECT site_id, COUNT(*) AS total, GROUP_CONCAT(id ORDER BY id) AS ids
FROM time_expire
GROUP BY site_id
HAVING total > 1;

DELETE t1
FROM time_expire t1
JOIN time_expire t2
  ON t1.site_id = t2.site_id
 AND t1.id < t2.id;

SELECT site_id, COUNT(*) AS total
FROM time_expire
GROUP BY site_id
HAVING total > 1;

ALTER TABLE time_expire
ADD UNIQUE KEY uq_time_expire_site_id (site_id);
