-- Allow Base64 attendance photos up to MEDIUMTEXT's 16,777,215-byte limit.
-- Preserve nullability, character set, collation and comment. Existing
-- MEDIUMTEXT/LONGTEXT columns are left untouched, so reruns are safe.
-- String defaults are omitted for compatibility with older MySQL versions
-- that do not support defaults on TEXT columns. Uploads always supply a value.
SELECT 'Connected to MySQL; inspecting attendance.clock_photo' AS progress,
  CONNECTION_ID() AS connection_id, DATABASE() AS database_name;

-- Bound metadata/row lock waits. These do not limit an active table rebuild.
SET SESSION lock_wait_timeout = 60;
SET SESSION innodb_lock_wait_timeout = 60;

SET @clock_photo_alter = (
  SELECT CASE
    WHEN DATA_TYPE IN ('mediumtext', 'longtext') THEN
      'SELECT ''clock_photo already supports large photos'' AS result'
    ELSE CONCAT(
      'ALTER TABLE attendance MODIFY COLUMN clock_photo MEDIUMTEXT',
      IF(CHARACTER_SET_NAME IS NULL, '', CONCAT(' CHARACTER SET ', CHARACTER_SET_NAME)),
      IF(COLLATION_NAME IS NULL, '', CONCAT(' COLLATE ', COLLATION_NAME)),
      IF(IS_NULLABLE = 'YES', ' NULL', ' NOT NULL'),
      ' COMMENT ', QUOTE(COLUMN_COMMENT)
    )
  END
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'attendance'
    AND COLUMN_NAME = 'clock_photo'
);

-- A missing column causes PREPARE to fail and the host is reported as failed.
PREPARE clock_photo_statement FROM @clock_photo_alter;
SELECT 'Applying change; a large attendance table may take time to rebuild' AS progress;
EXECUTE clock_photo_statement;
DEALLOCATE PREPARE clock_photo_statement;

SHOW FULL COLUMNS FROM attendance LIKE 'clock_photo';
SELECT 'clock_photo migration complete' AS progress;
