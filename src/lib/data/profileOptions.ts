export const DATING_GOALS = [
  { value: "real_sex", label: "Реальный секс" },
  { value: "virtual_sex", label: "Виртуальный секс" },
  { value: "exchange_media", label: "Обмен фото и видео" },
  { value: "just_chat", label: "Просто общение" },
  { value: "one_time_meetings", label: "Одноразовые встречи" },
  { value: "ongoing_meetings", label: "Постоянные встречи" },
  { value: "sex_without_commitment", label: "Секс без обязательств" },
] as const;

export const GENDER_OPTIONS = [
  { value: "female", label: "Женщина" },
  { value: "male", label: "Мужчина" },
  { value: "couple_mf", label: "Пара МЖ" },
] as const;

export const SEXUAL_INTERESTS = [
  { value: "masturbation", label: "Мастурбация" },
  { value: "toys", label: "Секс с игрушками" },
  { value: "couple", label: "Секс вдвоём" },
  { value: "group", label: "Групповой секс" },
  { value: "same_sex", label: "Однополый секс" },
  { value: "bisexual_mf", label: "Бисексуальные встречи МЖЖ" },
  { value: "bisexual_mm", label: "Бисексуальные встречи ММЖ" },
  { value: "bdsm", label: "BDSM" },
  { value: "hotwife_cuckold", label: "SexWife | Cuckold" },
] as const;

export function getSexualInterestLabel(value?: string | null) {
  if (!value) return null;
  return SEXUAL_INTERESTS.find((interest) => interest.value === value || interest.label === value)?.label ?? null;
}

export function normalizeSexualInterests(values?: string[] | null) {
  return Array.from(
    new Set((values ?? []).map(getSexualInterestLabel).filter((value): value is string => Boolean(value)))
  );
}

export const LOOKING_FOR_OPTIONS = [
  { value: "married_couple_mf", label: "Семейная пара МЖ" },
  { value: "unmarried_couple_mf", label: "Несемейная пара МЖ" },
  { value: "man", label: "Парня" },
  { value: "woman", label: "Девушку" },
  { value: "two_men", label: "Два парня" },
  { value: "two_women", label: "Две девушки" },
] as const;

export const AGE_PREFERENCE_OPTIONS = [
  { value: "any", label: "Возраст значения не имеет" },
  { value: "same_age", label: "С людьми моего (нашего) возраста" },
  { value: "plus_minus_5", label: "Моего (нашего) возраста или с разницей +/- 5 лет" },
  { value: "plus_minus_10", label: "Моего (нашего) возраста или с разницей +/- 10 лет" },
] as const;

export const MEETING_PLACE_OPTIONS = [
  { value: "our_home", label: "У себя дома (пригласим к себе)" },
  { value: "their_home", label: "У вас дома (примем приглашение)" },
  { value: "club_party", label: "В свинг-клубе или на закрытой вечеринке" },
  { value: "sauna", label: "Сауна" },
  { value: "neutral", label: "Нейтральная территория (гостиница или съёмная квартира)" },
] as const;

export const MOBILITY_OPTIONS = [
  { value: "none", label: "Не выезжаю(ем) в другие города" },
  { value: "50km", label: "Приезд возможен на расстояние +50км" },
  { value: "100km", label: "Приезд возможен на расстояние +100км" },
  { value: "150km", label: "Приезд возможен на расстояние +150км" },
  { value: "20km", label: "Приезд возможен на расстояние +20км" },
  { value: "unlimited", label: "Расстояние не помеха" },
] as const;

export const SMOKING_ATTITUDE_OPTIONS = [
  { value: "negative", label: "Негативное" },
  { value: "positive", label: "Положительное" },
  { value: "neutral", label: "Нейтральное" },
] as const;

export const DRINKING_ATTITUDE_OPTIONS = [
  { value: "negative", label: "Негативное" },
  { value: "positive", label: "Положительное" },
  { value: "neutral", label: "Нейтральное" },
] as const;

export const ORIENTATION_ROLES = [
  { value: "hetero", label: "Гетеро" },
  { value: "bi", label: "Би" },
  { value: "lesbian", label: "Лесби" },
  { value: "universal", label: "Универсал" },
] as const;

export const BREAST_SIZE_OPTIONS = [
  { value: "1", label: "1" },
  { value: "2", label: "2" },
  { value: "3", label: "3" },
  { value: "4", label: "4" },
  { value: "5", label: "5" },
  { value: "very_large", label: "Очень большая" },
] as const;

export const PENIS_SIZE_OPTIONS = [
  { value: "10", label: "10 см" },
  { value: "12", label: "12 см" },
  { value: "14", label: "14 см" },
  { value: "16", label: "16 см" },
  { value: "18", label: "18 см" },
  { value: "20", label: "20 см" },
] as const;

export function getOrientationLabel(value?: string | null) {
  if (!value) return null;
  const legacyLabels: Record<string, string> = {
    active: "Актив",
    passive: "Пассив",
    switch: "Универсал",
  };
  return ORIENTATION_ROLES.find((role) => role.value === value)?.label ?? legacyLabels[value] ?? value;
}

export function getDatingGoalLabel(value?: string | null) {
  if (!value) return null;
  const legacyValues: Record<string, string> = {
    serious_relationship: "Постоянные встречи",
    friendship: "Просто общение",
    dates: "Постоянные встречи",
    travel: "Просто общение",
    events: "Просто общение",
    networking: "Просто общение",
  };
  return DATING_GOALS.find((goal) => goal.value === value)?.label ?? legacyValues[value] ?? null;
}

export function normalizeDatingGoal(value?: string | null) {
  if (!value) return "";
  const legacyValues: Record<string, string> = {
    serious_relationship: "ongoing_meetings",
    friendship: "just_chat",
    dates: "ongoing_meetings",
    travel: "just_chat",
    events: "just_chat",
    networking: "just_chat",
  };
  return DATING_GOALS.some((goal) => goal.value === value) ? value : legacyValues[value] ?? "";
}

export function getLookingForLabel(value?: string | null) {
  if (!value) return null;
  const legacyValues: Record<string, string> = {
    two_girls_or_two_guys: "Две девушки / Два парня",
  };
  return LOOKING_FOR_OPTIONS.find((option) => option.value === value)?.label ?? legacyValues[value] ?? value;
}

export function normalizeLookingFor(values?: string[] | null) {
  const normalized: string[] = [];
  for (const value of values ?? []) {
    if (value === "two_girls_or_two_guys") {
      normalized.push("two_men", "two_women");
    } else if (LOOKING_FOR_OPTIONS.some((option) => option.value === value)) {
      normalized.push(value);
    }
  }
  return Array.from(new Set(normalized));
}

export function normalizeOrientationValues(values?: string[] | null) {
  const normalized = (values ?? []).map((value) => value === "switch" ? "universal" : value);
  return Array.from(new Set(normalized.filter((value) => ORIENTATION_ROLES.some((option) => option.value === value))));
}

export function getSmokingAttitudeLabel(value?: string | null) {
  if (!value) return null;
  const legacyValues: Record<string, string> = {
    non_smoker_intolerant: "Негативное",
    non_smoker_tolerant: "Нейтральное",
    smoker_can_abstain: "Положительное",
    smoker_cannot_abstain: "Положительное",
  };
  return getLabel(SMOKING_ATTITUDE_OPTIONS, value) ?? legacyValues[value] ?? value;
}

export function normalizeSmokingAttitude(value?: string | null) {
  if (!value) return "";
  const legacyValues: Record<string, string> = {
    non_smoker_intolerant: "negative",
    non_smoker_tolerant: "neutral",
    smoker_can_abstain: "positive",
    smoker_cannot_abstain: "positive",
  };
  return SMOKING_ATTITUDE_OPTIONS.some((option) => option.value === value) ? value : legacyValues[value] ?? "";
}

export function getDrinkingAttitudeLabel(value?: string | null) {
  if (!value) return null;
  const legacyValues: Record<string, string> = {
    none: "Негативное",
    insignificant: "Нейтральное",
    moderate: "Положительное",
    heavy: "Положительное",
  };
  return getLabel(DRINKING_ATTITUDE_OPTIONS, value) ?? legacyValues[value] ?? value;
}

export function normalizeDrinkingAttitude(value?: string | null) {
  if (!value) return "";
  const legacyValues: Record<string, string> = {
    none: "negative",
    insignificant: "neutral",
    moderate: "positive",
    heavy: "positive",
  };
  return DRINKING_ATTITUDE_OPTIONS.some((option) => option.value === value) ? value : legacyValues[value] ?? "";
}

export function getMobilityLabel(value?: string | null) {
  if (!value) return null;
  const legacyValues: Record<string, string> = {
    "200km": "Приезд возможен, если расстояние не превышает 200км.",
    "300km": "Приезд возможен, если расстояние не превышает 300км.",
    "400km": "Приезд возможен, если расстояние не превышает 400км.",
    "500km": "Приезд возможен, если расстояние не превышает 500км.",
  };
  return getLabel(MOBILITY_OPTIONS, value) ?? legacyValues[value] ?? value;
}

export function getDatingGoalLabels(values?: string[] | null, fallback?: string | null) {
  const selected = values?.length ? values : fallback ? [fallback] : [];
  return selected.map((value) => getDatingGoalLabel(value) ?? value).filter(Boolean);
}

export function getGenderLabel(value?: string | null) {
  return GENDER_OPTIONS.find((g) => g.value === value)?.label ?? null;
}

export function getLabel(options: readonly { value: string; label: string }[], value?: string | null) {
  return options.find((o) => o.value === value)?.label ?? null;
}
