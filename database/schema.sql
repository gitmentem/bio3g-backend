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
