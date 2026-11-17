import { test } from 'node:test'
import assert from 'node:assert/strict'
import { AppError } from '../server/utils/appError'
import {
    assertLastAdmin,
    assertNotSelf,
    assertSystemRoleDeletable,
    assertSystemRoleProtected,
    isUsableAdmin,
} from '../server/utils/adminGuard'

function expectAppError(fn: () => void, key: string) {
    assert.throws(fn, (error: unknown) => (
        error instanceof AppError && error.i18nKey === key
    ))
}

test('isUsableAdmin only counts enabled admins', () => {
    assert.equal(isUsableAdmin({ isAdmin: 1, status: 1 }), true)
    assert.equal(isUsableAdmin({ isAdmin: 1, status: 0 }), false)
    assert.equal(isUsableAdmin({ isAdmin: 0, status: 1 }), false)
    assert.equal(isUsableAdmin({}), false)
})

test('assertNotSelf rejects operating on the current account', () => {
    expectAppError(() => assertNotSelf('u1', 'u1'), 'system.cannotOperateSelf')
    assert.doesNotThrow(() => assertNotSelf('u1', 'u2'))
    assert.doesNotThrow(() => assertNotSelf('u1', null))
})

test('assertLastAdmin requires at least one remaining admin', () => {
    expectAppError(() => assertLastAdmin(0), 'system.lastAdmin')
    expectAppError(() => assertLastAdmin(-1), 'system.lastAdmin')
    assert.doesNotThrow(() => assertLastAdmin(1))
})

test('system roles cannot be deleted', () => {
    expectAppError(
        () => assertSystemRoleDeletable({ isSystem: 1 }),
        'system.systemRoleProtected',
    )
    assert.doesNotThrow(() => assertSystemRoleDeletable({ isSystem: 0 }))
})

test('system roles only allow display-field updates', () => {
    const role = { isSystem: 1, code: 'admin', status: 1, dataScope: '1' }

    assert.doesNotThrow(() => assertSystemRoleProtected(role, {
        code: 'admin',
        status: 1,
        dataScope: '1',
    }))
    assert.doesNotThrow(() => assertSystemRoleProtected(role, { code: 'admin' }))

    expectAppError(
        () => assertSystemRoleProtected(role, { code: 'super-admin' }),
        'system.systemRoleProtected',
    )
    expectAppError(
        () => assertSystemRoleProtected(role, { status: 0 }),
        'system.systemRoleProtected',
    )
    expectAppError(
        () => assertSystemRoleProtected(role, { dataScope: '2' }),
        'system.systemRoleProtected',
    )
})

test('non-system roles are not restricted', () => {
    const role = { isSystem: 0, code: 'operator', status: 1, dataScope: '3' }

    assert.doesNotThrow(() => assertSystemRoleProtected(role, {
        code: 'ops',
        status: 0,
        dataScope: '5',
    }))
})
