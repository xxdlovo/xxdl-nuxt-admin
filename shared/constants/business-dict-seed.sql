-- Seed optimized dictionaries from shared/constants/business.ts.
-- Requires sys_dict_data.i18n_key and sys_dict_data.list_class:
--   ALTER TABLE sys_dict_data ADD COLUMN i18n_key VARCHAR(150) NULL COMMENT 'i18n key' AFTER label;
--   ALTER TABLE sys_dict_data ADD COLUMN list_class VARCHAR(30) NULL COMMENT 'badge color' AFTER i18n_key;
--
-- Merge rules:
--   ossBooleanRecord + topFlagRecord -> no_yes
--   jobLogStatusRecord + successFailureRecord -> job_log_status
--   yesNoRecord stays separate because its value mapping is reversed: 0=yes, 1=no.
-- list_class stores badge color metadata previously kept in business.ts color records.

INSERT INTO sys_dict_type (id, name, code, status, remark)
VALUES
  (UUID(), 'OSS Service', 'oss_service', 1, 'from business.ts ossServiceRecord'),
  (UUID(), 'OSS Access Policy', 'oss_access_policy', 1, 'from business.ts ossAccessPolicyRecord'),
  (UUID(), 'No Yes', 'no_yes', 1, 'from business.ts ossBooleanRecord, topFlagRecord'),
  (UUID(), 'OSS Verify Status', 'oss_verify_status', 1, 'from business.ts ossVerifyStatusRecord'),
  (UUID(), 'User Gender', 'user_gender', 1, 'from business.ts USER_GENDER_CONFIG, userGenderRecord'),
  (UUID(), 'Enable Status', 'enable_status', 1, 'from business.ts enableStatusRecord'),
  (UUID(), 'Job Status', 'job_status', 1, 'from business.ts jobStatusRecord'),
  (UUID(), 'Job Running Status', 'job_running_status', 1, 'from business.ts jobRunningStatusRecord'),
  (UUID(), 'Job Log Status', 'job_log_status', 1, 'from business.ts jobLogStatusRecord, successFailureRecord'),
  (UUID(), 'Job Trigger Type', 'job_trigger_type', 1, 'from business.ts jobTriggerTypeRecord'),
  (UUID(), 'Notice Type', 'notice_type', 1, 'from business.ts noticeTypeRecord'),
  (UUID(), 'Notice Publish Status', 'notice_publish_status', 1, 'from business.ts noticePublishStatusRecord'),
  (UUID(), 'Data Scope', 'data_scope', 1, 'from business.ts dataScopeRecord'),
  (UUID(), 'Yes No', 'yes_no', 1, 'from business.ts yesNoRecord'),
  (UUID(), 'Menu Type', 'menu_type', 1, 'from business.ts menuTypeRecord'),
  (UUID(), 'Menu Icon Type', 'menu_icon_type', 1, 'from business.ts menuIconTypeRecord'),
  (UUID(), 'System Log Level', 'sys_log_level', 1, 'from business.ts sysLogLevelRecord')
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  status = VALUES(status),
  remark = VALUES(remark);

INSERT INTO sys_dict_data (id, type_id, label, i18n_key, list_class, value, sort_order, status, remark)
SELECT UUID(), dt.id, seed.label, seed.i18n_key, seed.list_class, seed.value, seed.sort_order, 1, seed.remark
FROM (
  SELECT 'oss_service' code, 'aliyun' value, 'Aliyun' label, 'module.system.ossConfig.serviceAliyun' i18n_key, 'neutral' list_class, 1 sort_order, 'ossServiceRecord.aliyun' remark UNION ALL
  SELECT 'oss_service', 'tencent', 'Tencent', 'module.system.ossConfig.serviceTencent', 'neutral', 2, 'ossServiceRecord.tencent' UNION ALL
  SELECT 'oss_service', 'aws', 'AWS', 'module.system.ossConfig.serviceAws', 'neutral', 3, 'ossServiceRecord.aws' UNION ALL
  SELECT 'oss_access_policy', '0', 'Private', 'module.system.ossConfig.accessPolicyPrivate', 'warning', 1, 'ossAccessPolicyRecord.0' UNION ALL
  SELECT 'oss_access_policy', '1', 'Public', 'module.system.ossConfig.accessPolicyPublic', 'primary', 2, 'ossAccessPolicyRecord.1' UNION ALL
  SELECT 'no_yes', '0', 'No', 'common.yesOrNo.no', 'neutral', 1, 'ossBooleanRecord.0, topFlagRecord.0' UNION ALL
  SELECT 'no_yes', '1', 'Yes', 'common.yesOrNo.yes', 'primary', 2, 'ossBooleanRecord.1, topFlagRecord.1' UNION ALL
  SELECT 'oss_verify_status', '0', 'Pending', 'module.system.ossConfig.verifyPending', 'neutral', 1, 'ossVerifyStatusRecord.0' UNION ALL
  SELECT 'oss_verify_status', '1', 'Passed', 'module.system.ossConfig.verifyPassed', 'success', 2, 'ossVerifyStatusRecord.1' UNION ALL
  SELECT 'oss_verify_status', '2', 'Failed', 'module.system.ossConfig.verifyFailed', 'error', 3, 'ossVerifyStatusRecord.2' UNION ALL
  SELECT 'user_gender', '0', 'Unknown', 'module.system.user.gender.unknow', 'neutral', 1, 'USER_GENDER_CONFIG.0, userGenderRecord.0' UNION ALL
  SELECT 'user_gender', '1', 'Male', 'module.system.user.gender.male', 'primary', 2, 'USER_GENDER_CONFIG.1, userGenderRecord.1' UNION ALL
  SELECT 'user_gender', '2', 'Female', 'module.system.user.gender.female', 'error', 3, 'USER_GENDER_CONFIG.2, userGenderRecord.2' UNION ALL
  SELECT 'enable_status', '1', 'Enable', 'page.manage.common.status.enable', 'primary', 1, 'enableStatusRecord.1' UNION ALL
  SELECT 'enable_status', '2', 'Disable', 'page.manage.common.status.disable', 'warning', 2, 'enableStatusRecord.2' UNION ALL
  SELECT 'job_status', '0', 'Disable', 'page.manage.common.status.disable', 'warning', 1, 'jobStatusRecord.0' UNION ALL
  SELECT 'job_status', '1', 'Enable', 'page.manage.common.status.enable', 'primary', 2, 'jobStatusRecord.1' UNION ALL
  SELECT 'job_running_status', '0', 'Idle', 'module.system.job.runningStatus.idle', 'neutral', 1, 'jobRunningStatusRecord.0' UNION ALL
  SELECT 'job_running_status', '1', 'Running', 'module.system.job.runningStatus.running', 'warning', 2, 'jobRunningStatusRecord.1' UNION ALL
  SELECT 'job_log_status', '0', 'Running', 'module.system.jobLog.status.running', 'warning', 1, 'jobLogStatusRecord.0' UNION ALL
  SELECT 'job_log_status', '1', 'Success', 'module.system.jobLog.status.success', 'success', 2, 'jobLogStatusRecord.1, successFailureRecord.1' UNION ALL
  SELECT 'job_log_status', '2', 'Failed', 'module.system.jobLog.status.failed', 'error', 3, 'jobLogStatusRecord.2, successFailureRecord.2' UNION ALL
  SELECT 'job_log_status', '3', 'Skipped', 'module.system.jobLog.status.skipped', 'neutral', 4, 'jobLogStatusRecord.3' UNION ALL
  SELECT 'job_trigger_type', 'schedule', 'Schedule', 'module.system.jobLog.triggerType.schedule', 'primary', 1, 'jobTriggerTypeRecord.schedule' UNION ALL
  SELECT 'job_trigger_type', 'manual', 'Manual', 'module.system.jobLog.triggerType.manual', 'info', 2, 'jobTriggerTypeRecord.manual' UNION ALL
  SELECT 'notice_type', '1', 'Notice', 'module.system.notice.type.notice', 'primary', 1, 'noticeTypeRecord.1' UNION ALL
  SELECT 'notice_type', '2', 'Announcement', 'module.system.notice.type.announcement', 'info', 2, 'noticeTypeRecord.2' UNION ALL
  SELECT 'notice_publish_status', '1', 'Published', 'module.system.notice.publishStatus.published', 'primary', 1, 'noticePublishStatusRecord.1' UNION ALL
  SELECT 'notice_publish_status', '2', 'Draft', 'module.system.notice.publishStatus.draft', 'neutral', 2, 'noticePublishStatusRecord.2' UNION ALL
  SELECT 'data_scope', '1', 'All', 'module.system.role.dataScopeOptions.all', 'error', 1, 'dataScopeRecord.1' UNION ALL
  SELECT 'data_scope', '2', 'Custom', 'module.system.role.dataScopeOptions.custom', 'warning', 2, 'dataScopeRecord.2' UNION ALL
  SELECT 'data_scope', '3', 'Department', 'module.system.role.dataScopeOptions.dept', 'info', 3, 'dataScopeRecord.3' UNION ALL
  SELECT 'data_scope', '4', 'Department And Children', 'module.system.role.dataScopeOptions.deptAndChild', 'info', 4, 'dataScopeRecord.4' UNION ALL
  SELECT 'data_scope', '5', 'Self', 'module.system.role.dataScopeOptions.self', 'success', 5, 'dataScopeRecord.5' UNION ALL
  SELECT 'data_scope', '6', 'Department And Children Or Self', 'module.system.role.dataScopeOptions.deptAndChildOrSelf', 'neutral', 6, 'dataScopeRecord.6' UNION ALL
  SELECT 'yes_no', '0', 'Yes', 'common.yesOrNo.yes', 'error', 1, 'yesNoRecord.0' UNION ALL
  SELECT 'yes_no', '1', 'No', 'common.yesOrNo.no', 'neutral', 2, 'yesNoRecord.1' UNION ALL
  SELECT 'menu_type', '0', 'Directory', 'module.system.menu.type.directory', 'neutral', 1, 'menuTypeRecord.0' UNION ALL
  SELECT 'menu_type', '1', 'Menu', 'module.system.menu.type.menu', 'primary', 2, 'menuTypeRecord.1' UNION ALL
  SELECT 'menu_type', '2', 'Button', 'module.system.menu.type.button', 'warning', 3, 'menuTypeRecord.2' UNION ALL
  SELECT 'menu_icon_type', '1', 'Iconify', 'page.manage.menu.iconType.iconify', 'primary', 1, 'menuIconTypeRecord.1' UNION ALL
  SELECT 'menu_icon_type', '2', 'Local', 'page.manage.menu.iconType.local', 'neutral', 2, 'menuIconTypeRecord.2' UNION ALL
  SELECT 'sys_log_level', '0', 'Info', 'module.system.sysLog.level.0', 'info', 1, 'sysLogLevelRecord.0' UNION ALL
  SELECT 'sys_log_level', '1', 'Warning', 'module.system.sysLog.level.1', 'warning', 2, 'sysLogLevelRecord.1' UNION ALL
  SELECT 'sys_log_level', '2', 'Error', 'module.system.sysLog.level.2', 'error', 3, 'sysLogLevelRecord.2' UNION ALL
  SELECT 'sys_log_level', '3', 'Neutral', 'module.system.sysLog.level.3', 'neutral', 4, 'sysLogLevelRecord.3'
) seed
INNER JOIN sys_dict_type dt ON dt.code = seed.code
WHERE NOT EXISTS (
  SELECT 1
  FROM sys_dict_data dd
  WHERE dd.type_id = dt.id
    AND dd.value = seed.value
    AND dd.is_deleted = 0
);


-- Backfill list_class for existing dictionary data rows.
UPDATE sys_dict_data dd
INNER JOIN sys_dict_type dt ON dt.id = dd.type_id
SET dd.list_class = CASE CONCAT(dt.code, ':', dd.value)
    WHEN 'oss_service:aliyun' THEN 'neutral'
    WHEN 'oss_service:tencent' THEN 'neutral'
    WHEN 'oss_service:aws' THEN 'neutral'
    WHEN 'oss_access_policy:0' THEN 'warning'
    WHEN 'oss_access_policy:1' THEN 'primary'
    WHEN 'no_yes:0' THEN 'neutral'
    WHEN 'no_yes:1' THEN 'primary'
    WHEN 'oss_verify_status:0' THEN 'neutral'
    WHEN 'oss_verify_status:1' THEN 'success'
    WHEN 'oss_verify_status:2' THEN 'error'
    WHEN 'user_gender:0' THEN 'neutral'
    WHEN 'user_gender:1' THEN 'primary'
    WHEN 'user_gender:2' THEN 'error'
    WHEN 'enable_status:1' THEN 'primary'
    WHEN 'enable_status:2' THEN 'warning'
    WHEN 'job_status:0' THEN 'warning'
    WHEN 'job_status:1' THEN 'primary'
    WHEN 'job_running_status:0' THEN 'neutral'
    WHEN 'job_running_status:1' THEN 'warning'
    WHEN 'job_log_status:0' THEN 'warning'
    WHEN 'job_log_status:1' THEN 'success'
    WHEN 'job_log_status:2' THEN 'error'
    WHEN 'job_log_status:3' THEN 'neutral'
    WHEN 'job_trigger_type:schedule' THEN 'primary'
    WHEN 'job_trigger_type:manual' THEN 'info'
    WHEN 'notice_type:1' THEN 'primary'
    WHEN 'notice_type:2' THEN 'info'
    WHEN 'notice_publish_status:1' THEN 'primary'
    WHEN 'notice_publish_status:2' THEN 'neutral'
    WHEN 'data_scope:1' THEN 'error'
    WHEN 'data_scope:2' THEN 'warning'
    WHEN 'data_scope:3' THEN 'info'
    WHEN 'data_scope:4' THEN 'info'
    WHEN 'data_scope:5' THEN 'success'
    WHEN 'data_scope:6' THEN 'neutral'
    WHEN 'yes_no:0' THEN 'error'
    WHEN 'yes_no:1' THEN 'neutral'
    WHEN 'menu_type:0' THEN 'neutral'
    WHEN 'menu_type:1' THEN 'primary'
    WHEN 'menu_type:2' THEN 'warning'
    WHEN 'menu_icon_type:1' THEN 'primary'
    WHEN 'menu_icon_type:2' THEN 'neutral'
    WHEN 'sys_log_level:0' THEN 'info'
    WHEN 'sys_log_level:1' THEN 'warning'
    WHEN 'sys_log_level:2' THEN 'error'
    WHEN 'sys_log_level:3' THEN 'neutral'
    ELSE dd.list_class
  END
WHERE dt.code IN ('oss_service', 'oss_access_policy', 'no_yes', 'oss_verify_status', 'user_gender', 'enable_status', 'job_status', 'job_running_status', 'job_log_status', 'job_trigger_type', 'notice_type', 'notice_publish_status', 'data_scope', 'yes_no', 'menu_type', 'menu_icon_type', 'sys_log_level')
  AND dd.is_deleted = 0;
