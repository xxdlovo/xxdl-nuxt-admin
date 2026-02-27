// generate-sys-user-data.ts
import { randomUUID } from 'crypto';
import fs from 'fs/promises';

/**
 * 生成随机IP地址
 */
const generateRandomIp = (): string => {
    return `${Math.floor(Math.random() * 256)}.${Math.floor(Math.random() * 256)}.${Math.floor(Math.random() * 256)}.${Math.floor(Math.random() * 256)}`;
};

/**
 * 生成随机时间（近30天内）
 */
const generateRandomTime = (): string => {
    const now = new Date();
    const randomDays = Math.floor(Math.random() * 30);
    const randomTime = new Date(now.getTime() - randomDays * 24 * 60 * 60 * 1000);
    return randomTime.toISOString().slice(0, 19).replace('T', ' ');
};

/**
 * 生成随机手机号码
 * @param prefix 手机号前缀，默认138
 */
const generateRandomPhone = (prefix = '138'): string => {
    const suffix = Math.floor(Math.random() * 100000000).toString().padStart(8, '0');
    return `${prefix}${suffix}`;
};

/**
 * 生成随机昵称
 * @param index 用户序号
 */
const generateNickname = (index: number): string => {
    const prefixes = ['测试', '研发', '运营', '产品', '客服'];
    const randomPrefix = prefixes[Math.floor(Math.random() * prefixes.length)];
    return `${randomPrefix}用户${index.toString().padStart(2, '0')}`;
};

/**
 * 生成带随机时间戳的用户名（核心修改）
 * @param index 用户序号
 * @returns 唯一的用户名，格式：user + 两位序号 + 时间戳后6位 + 随机3位数
 */
const generateUsername = (index: number): string => {
    // 获取时间戳（秒级），取后6位保证长度适中
    const timestamp = Date.now().toString().slice(-6);
    // 生成3位随机数，进一步保证唯一性
    const randomNum = Math.floor(Math.random() * 900) + 100;
    // 拼接用户名：固定前缀 + 序号 + 时间戳 + 随机数
    return `user${index.toString().padStart(2, '0')}_${timestamp}_${randomNum}`;
};

/**
 * sys_user表数据类型定义
 */
interface SysUserData {
    id: string;
    username: string;
    password: string;
    email: string;
    nickname: string;
    avatar: string;
    phone: string;
    gender: number;
    dept_id: string;
    is_admin: number;
    last_login_time: string | null;
    last_login_ip: string | null;
    status: number;
    remark: string;
    created_by: string;
    created_at: string;
    updated_by: string;
    updated_at: string;
    is_deleted: number;
}

/**
 * 生成sys_user表的单条随机数据
 * @param index 数据序号
 */
const generateSysUserRow = (index: number): SysUserData => {
    const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
    const isAdmin = Math.random() > 0.9 ? 1 : 0; // 10%概率为管理员
    const isDisabled = Math.random() > 0.8 ? 2 : 1; // 20%概率禁用
    const hasLogin = Math.random() > 0.2; // 80%概率有登录记录

    // 调用新的用户名生成函数（核心修改）
    const username = generateUsername(index);
    // 邮箱跟随用户名变化，保证唯一性
    const email = `${username}@example.com`;

    return {
        id: randomUUID(),
        username: username, // 使用带时间戳的用户名
        password: '$2a$10$8Hx9R8Z7s6D5F4G3H2J1K0', // 模拟加密密码（123456）
        email: email, // 同步更新邮箱，保证唯一
        nickname: generateNickname(index),
        avatar: `https://picsum.photos/200/200?random=${index}`,
        phone: generateRandomPhone(),
        gender: Math.floor(Math.random() * 3), // 0-未知,1-男,2-女
        dept_id: randomUUID(),
        is_admin: isAdmin,
        last_login_time: hasLogin ? generateRandomTime() : null,
        last_login_ip: hasLogin ? generateRandomIp() : null,
        status: isDisabled,
        remark: isAdmin ? `管理员${index.toString().padStart(2, '0')}` : `测试用户${index.toString().padStart(2, '0')}`,
        created_by: randomUUID(),
        created_at: now,
        updated_by: randomUUID(),
        updated_at: now,
        is_deleted: 0
    };
};

/**
 * 生成SQL插入语句
 * @param count 生成数据条数
 */
const generateInsertSql = (count = 20): string => {
    const rows: SysUserData[] = [];
    for (let i = 1; i <= count; i++) {
        rows.push(generateSysUserRow(i));
    }

    // 构建字段列表
    const fields = [
        'id', 'username', 'password', 'email', 'nickname',
        'avatar', 'phone', 'gender', 'dept_id', 'is_admin',
        'last_login_time', 'last_login_ip', 'status', 'remark',
        'created_by', 'created_at', 'updated_by', 'updated_at', 'is_deleted'
    ];

    // 构建VALUES部分
    const values = rows.map(row => {
        const valuesArr = fields.map(field => {
            const value = (row as any)[field];
            if (value === null) return 'NULL';
            if (typeof value === 'string') return `'${value.replace(/'/g, "\\'")}'`; // 转义单引号
            return value;
        });
        return `(${valuesArr.join(', ')})`;
    }).join(',\n');

    // 拼接完整SQL
    return `-- 自动生成的sys_user表测试数据（${count}条）
INSERT INTO \`sys_user\` (
  ${fields.map(f => `\`${f}\``).join(', ')}
) VALUES
${values};`;
};

/**
 * 主执行逻辑
 */
const main = async () => {
    try {
        const sql = generateInsertSql(20);
        // 输出SQL到控制台
        console.log(sql);

        // 写入文件
        await fs.writeFile('sys_user_test_data.sql', sql, 'utf8');
        console.log('\n✅ SQL已写入 sys_user_test_data.sql 文件');
    } catch (error) {
        console.error('❌ 生成数据失败:', error);
    }
};

// 执行脚本
main();