/**
 * 关系等级解析器
 * 根据好感度值或关系名称解析对应的关系等级配置
 */

import type { Config, RelationshipLevel } from '../../types'

export function createLevelResolver(config: Config) {
    const resolveLevelByAffinity = (value: number): RelationshipLevel | null => {
        const levels = config.relationshipAffinityLevels || []
        for (const level of levels) {
            if (value >= level.min && value <= level.max) return level
        }
        return null
    }

    const resolveLevelByRelation = (relationName: string): RelationshipLevel | null => {
        const levels = config.relationshipAffinityLevels || []
        return levels.find((level) => level.relation === relationName) || null
    }

    return {
        resolveLevelByAffinity,
        resolveLevelByRelation
    }
}

export type LevelResolver = ReturnType<typeof createLevelResolver>
