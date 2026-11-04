
// 导入所有的表定义（系统域，不含电商域）
import { sysDepartment } from "./system/department"
import { sysConfig } from "./system/config"
import { sysDictData } from "./system/dictData"
import { sysDictType } from "./system/dictType"
import { sysJob } from "./system/job"
import { sysJobLog } from "./system/jobLog"
import { sysLoginLog } from "./system/loginLog"
import { sysMenu } from "./system/menu"
import { sysNotice } from "./system/notice"
import { sysOauthAccount } from "./system/oauthAccount"
import { sysOauthConfig } from "./system/oauthConfig"
import { sysOss } from "./system/oss"
import { sysOssConfig } from "./system/ossConfig"
import { sysRole } from "./system/role"
import { sysRoleMenu } from "./system/roleMenu"
import { sysSystemLog } from "./system/systemLog"
import { sysUser } from "./system/user"
import { sysUserRole } from "./system/userRole"
import { demo } from "./demo/index"

// 导出所有表定义
//
// 注意：电商域（会员/商品/订单/支付/钱包）的表定义位于可选的
// `xxdl-admin-trade` 层，不在本文件内。需要它们时通过该层的
// `#trade/server/drizzle/schema` 引入（该入口会 re-export 本文件）。
export {
  demo,
  sysConfig,
  sysDepartment,
  sysDictData,
  sysDictType,
  sysJob,
  sysJobLog,
  sysLoginLog,
  sysMenu,
  sysNotice,
  sysOauthAccount,
  sysOauthConfig,
  sysOss,
  sysOssConfig,
  sysRole,
  sysRoleMenu,
  sysSystemLog,
  sysUser,
  sysUserRole,
};
