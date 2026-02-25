/**
 * 自动补全策略
 * 根据配置与模板约束决定文本和图片补全行为
 */

import type { Config, EmptyTextAutoFillRule } from "../config";
import type { GenerateImageInput, MemeParamsType } from "../types";

export interface AutoFillInput {
  texts: string[];
  images: GenerateImageInput[];
  params: MemeParamsType;
  config: Config;
  senderAvatarImage?: GenerateImageInput;
  targetAvatarImage?: GenerateImageInput;
  secondaryTargetAvatarImage?: GenerateImageInput;
  botAvatarImage?: GenerateImageInput;
  senderName?: string;
  groupNicknameText?: string;
  preferredTextSource?: EmptyTextAutoFillRule["source"];
}

export interface AutoFillResult {
  texts: string[];
  images: GenerateImageInput[];
  selectedTextSource?: EmptyTextAutoFillRule["source"] | "group-nickname";
}

function getRuleWeight(rule: EmptyTextAutoFillRule): number {
  if (!rule.enabled) return 0;
  if (!Number.isFinite(rule.weight)) return 0;
  return Math.max(0, rule.weight);
}

function chooseRuleByWeight(
  rules: EmptyTextAutoFillRule[],
): EmptyTextAutoFillRule | undefined {
  const weightedRules = rules
    .map((rule) => ({ rule, weight: getRuleWeight(rule) }))
    .filter((item) => item.weight > 0);

  if (weightedRules.length === 0) return undefined;

  const totalWeight = weightedRules.reduce((sum, item) => sum + item.weight, 0);
  const randomValue = Math.random() * totalWeight;

  let accumulated = 0;
  for (const item of weightedRules) {
    accumulated += item.weight;
    if (randomValue < accumulated) return item.rule;
  }

  return weightedRules[weightedRules.length - 1]?.rule;
}

function getTemplateDefaultTexts(params: MemeParamsType): string[] {
  return params.default_texts.filter(Boolean);
}

function getUserNicknameText(senderName?: string): string[] {
  const trimmedName = senderName?.trim();
  if (!trimmedName) return [];
  return [trimmedName];
}

function getSourceTexts(
  source: EmptyTextAutoFillRule["source"],
  params: MemeParamsType,
  senderName?: string,
): string[] {
  if (source === "template-default") {
    return getTemplateDefaultTexts(params);
  }

  if (params.min_texts > 1) return [];

  return getUserNicknameText(senderName);
}

function choosePreferredRule(
  rules: EmptyTextAutoFillRule[],
  preferredSource?: EmptyTextAutoFillRule["source"],
): EmptyTextAutoFillRule | undefined {
  if (!preferredSource) return undefined;
  const preferredRule = rules.find(
    (rule) => rule.source === preferredSource && getRuleWeight(rule) > 0,
  );
  return preferredRule;
}

function resolveEmptyTexts(
  params: MemeParamsType,
  config: Config,
  senderName?: string,
  groupNicknameText?: string,
  preferredTextSource?: EmptyTextAutoFillRule["source"],
): {
  texts: string[];
  selectedTextSource?: EmptyTextAutoFillRule["source"] | "group-nickname";
} {
  if (params.max_texts <= 0) return { texts: [] };

  const selectedRule =
    choosePreferredRule(config.emptyTextAutoFillRules, preferredTextSource) ||
    chooseRuleByWeight(config.emptyTextAutoFillRules);

  if (selectedRule) {
    const selectedTexts = getSourceTexts(
      selectedRule.source,
      params,
      senderName,
    );
    if (selectedTexts.length > 0) {
      return {
        texts: selectedTexts,
        selectedTextSource: selectedRule.source,
      };
    }
  }

  const fallbackRules = config.emptyTextAutoFillRules.filter(
    (rule) => getRuleWeight(rule) > 0 && rule.source !== selectedRule?.source,
  );

  for (const rule of fallbackRules) {
    const fallbackTexts = getSourceTexts(rule.source, params, senderName);
    if (fallbackTexts.length > 0) {
      return {
        texts: fallbackTexts,
        selectedTextSource: rule.source,
      };
    }
  }

  const hasTemplateDefaultTexts = getTemplateDefaultTexts(params).length > 0;
  if (
    config.autoUseGroupNicknameWhenNoDefaultText &&
    !hasTemplateDefaultTexts &&
    params.min_texts <= 1
  ) {
    const groupNickname = groupNicknameText?.trim();
    if (groupNickname) {
      return {
        texts: [groupNickname],
        selectedTextSource: "group-nickname",
      };
    }
  }

  return { texts: [] };
}

export function applyAutoFillPolicy(input: AutoFillInput): AutoFillResult {
  const texts = input.texts.filter(Boolean);
  const images = [...input.images];

  let selectedTextSource:
    | EmptyTextAutoFillRule["source"]
    | "group-nickname"
    | undefined;

  const shouldAutoFillTexts =
    texts.length === 0 || texts.length < input.params.min_texts;

  if (shouldAutoFillTexts) {
    const resolved = resolveEmptyTexts(
      input.params,
      input.config,
      input.senderName,
      input.groupNicknameText,
      input.preferredTextSource,
    );

    const fallbackTexts =
      texts.length === 0
        ? resolved.texts
        : resolved.texts.slice(
            0,
            Math.max(0, input.params.min_texts - texts.length),
          );

    if (fallbackTexts.length > 0) {
      texts.push(...fallbackTexts);
      selectedTextSource = resolved.selectedTextSource;
    }
  }

  const minImages = input.params.min_images;
  const userImageCount = images.length;

  if (
    input.config.autoUseAvatarWhenMinImagesOneAndNoImage &&
    minImages === 1 &&
    userImageCount === 0 &&
    input.senderAvatarImage
  ) {
    images.push(input.senderAvatarImage);
    return { texts, images, selectedTextSource };
  }

  if (
    input.config.autoFillSenderAndBotAvatarsWhenMinImagesTwoAndNoImage &&
    minImages === 2 &&
    userImageCount === 0 &&
    input.targetAvatarImage
  ) {
    if (input.secondaryTargetAvatarImage) {
      images.push(input.targetAvatarImage, input.secondaryTargetAvatarImage);
      return { texts, images, selectedTextSource };
    }

    if (input.senderAvatarImage) {
      images.push(input.senderAvatarImage, input.targetAvatarImage);
      return { texts, images, selectedTextSource };
    }

    if (input.botAvatarImage) {
      images.push(input.targetAvatarImage, input.botAvatarImage);
      return { texts, images, selectedTextSource };
    }
  }

  if (
    input.config.autoFillSenderAndBotAvatarsWhenMinImagesTwoAndNoImage &&
    minImages === 2 &&
    userImageCount === 0 &&
    input.senderAvatarImage &&
    input.botAvatarImage
  ) {
    images.push(input.senderAvatarImage, input.botAvatarImage);
    return { texts, images, selectedTextSource };
  }

  const missing = minImages - userImageCount;

  if (
    input.config.autoFillOneMissingImageWithAvatar &&
    userImageCount > 0 &&
    missing === 1 &&
    input.senderAvatarImage
  ) {
    images.push(input.senderAvatarImage);
  }

  return { texts, images, selectedTextSource };
}
