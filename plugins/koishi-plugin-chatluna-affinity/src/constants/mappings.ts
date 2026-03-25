/**
 * 映射表常量
 * 包含角色映射、网盘类型等静态映射数据
 */

import type { RoleMapping } from '../types'

export const ROLE_MAPPING: RoleMapping = {
    direct: {
        owner: '群主',
        群主: '群主',
        主人: '群主',
        房主: '群主',
        会长: '群主',
        团长: '群主',
        admin: '管理员',
        administrator: '管理员',
        manager: '管理员',
        管理员: '管理员',
        管理: '管理员',
        member: '群员',
        members: '群员',
        normal: '群员',
        user: '群员',
        participant: '群员',
        群员: '群员',
        成员: '群员',
        普通成员: '群员',
        普通群员: '群员'
    },
    keywords: {
        owner: ['owner', 'host', 'leader', 'master', 'boss'],
        admin: ['admin', 'manager', 'moderator', 'administrator'],
        member: ['member', 'user', 'participant', 'normal']
    },
    numeric: {
        '2': '群主',
        '1': '管理员',
        '0': '群员'
    }
}

export const CLOUD_TYPES: Record<string, string> = {
    aliyundrive: '阿里云盘',
    baiduwangpan: '百度网盘',
    quark: '夸克网盘',
    xunlei: '迅雷云盘',
    '115': '115网盘',
    tianyi: '天翼云盘',
    googledrive: 'Google Drive',
    onedrive: 'OneDrive',
    dropbox: 'Dropbox',
    mega: 'MEGA',
    pikpak: 'PikPak',
    uc: 'UC网盘'
}

export const DEFAULT_MEMBER_INFO_ITEMS = [
    'nickname',
    'userId',
    'role',
    'level',
    'title'
] as const

export const ALL_MEMBER_INFO_ITEMS = [
    'nickname',
    'userId',
    'role',
    'level',
    'title',
    'gender',
    'age',
    'area',
    'joinTime',
    'lastSentTime',
    'chatCount'
] as const
