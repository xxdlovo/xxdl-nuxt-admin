-- ============================================================================
-- 代码生成 V2：AI 接入
--
-- 说明：V2 不在服务端调用大模型，只提供外部 AI 可读取/调用的生成接口与文档。
-- 本脚本仅调整菜单名称，不新增表，不改 init.sql / mysql-ddl.sql。
-- 执行：mysql -u <user> -p <database> < sql/migrations/2026-11-16-p3-ai-codegen.sql
-- ============================================================================

UPDATE sys_menu
SET name = '代码生成 V2',
    remark = '代码生成 V2（AI 接入，不调用大模型）'
WHERE code = 'system:gen'
  AND is_deleted = 0;
