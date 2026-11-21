/**
 * 「能力与配额」演示页的**进程级内存存储**。
 *
 * 只服务于演示：不建表、不写库、不参与任何真实业务。接口（server/api/**）与计量器
 * （server/plugins/entitlement-showcase.ts）共用本文件里的同一份数据，因此
 * 「已用量」永远等于接口能看到的数据量 —— 这正是演示要的效果。
 *
 * 生命周期：模块级 Map，进程启动时为空，重启（含开发热重启）即清空。
 * 多个进程 / Serverless 多实例之间**不共享**，不要把它当业务存储使用。
 */
import { randomUuid } from '#admin/shared/utils/uuid'

/** 演示班级（内存行，结构与真实业务表无关） */
export type ShowcaseClass = {
  id: string
  userId: string
  name: string
  createdAt: string
}

/** 班级名称长度上限（与页面输入框的 maxlength 对齐） */
const NAME_MAX_LENGTH = 40

/**
 * 单用户最多保留条数。
 *
 * 只是**演示用的安全阀**：反复点「新建」时不能把内存撑爆，也不能让列表无限长。
 * 到达上限后丢弃最旧的一条（配额上限由能力目录决定，和这个安全阀无关）。
 */
const MAX_ITEMS_PER_USER = 50

/** userId → 班级列表 */
const classStore = new Map<string, ShowcaseClass[]>()

/** userId → 隐藏配额条目（只保留 id，演示不关心内容） */
const hiddenStore = new Map<string, Array<{ id: string }>>()

/** 去掉首尾空白并截断到长度上限；调用方负责非空校验（空名会被拒绝，不会走到这里） */
function normalizeName(name: string): string {
  return name.trim().slice(0, NAME_MAX_LENGTH)
}

/** 把新行放进该用户的列表，并执行「最多保留 50 条」的安全阀 */
function pushCapped<T>(store: Map<string, T[]>, userId: string, row: T): void {
  const rows = store.get(userId) ?? []
  rows.push(row)

  while (rows.length > MAX_ITEMS_PER_USER) {
    rows.shift()
  }

  store.set(userId, rows)
}

export const showcaseClassStore = {
  /** 当前用户的班级列表（返回副本，避免调用方直接改内部数组） */
  list(userId: string): ShowcaseClass[] {
    return [...(classStore.get(userId) ?? [])]
  },

  /** 当前用户的班级数（配额已用量） */
  count(userId: string): number {
    return classStore.get(userId)?.length ?? 0
  },

  /** 新建一条班级（调用方必须**先**通过 assertEntitlement 校验，再调用本方法） */
  create(userId: string, name: string): ShowcaseClass {
    const created: ShowcaseClass = {
      id: randomUuid(),
      userId,
      name: normalizeName(name),
      createdAt: new Date().toISOString()
    }

    pushCapped(classStore, userId, created)

    return created
  },

  /** 删除自己的某条班级；返回是否真的删掉了（别人的 id 一律 false） */
  remove(userId: string, id: string): boolean {
    const rows = classStore.get(userId)

    if (!rows) {
      return false
    }

    const index = rows.findIndex(row => row.id === id)

    if (index < 0) {
      return false
    }

    rows.splice(index, 1)

    return true
  }
}

/** 隐藏配额演示用的计数（与班级共用同一份数据，独立计数即可） */
export function countShowcaseHidden(userId: string): number {
  return hiddenStore.get(userId)?.length ?? 0
}

/** 隐藏配额演示：新建一条（同上，调用方必须先校验） */
export function createShowcaseHidden(userId: string): { id: string } {
  const created = { id: randomUuid() }

  pushCapped(hiddenStore, userId, created)

  return created
}
