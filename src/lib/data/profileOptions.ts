export const DATING_GOALS = [
  { value: "real_sex", label: "Реальный секс" },
  { value: "virtual_sex", label: "Виртуальный секс" },
  { value: "exchange_media", label: "Обмен фото и видео" },
  { value: "just_chat", label: "Просто общение" },
  { value: "serious_relationship", label: "Серьезные отношения" },
  { value: "friendship", label: "Дружба и общение" },
  { value: "dates", label: "Свидания" },
  { value: "travel", label: "Попутчики и путешествия" },
  { value: "events", label: "Компания на мероприятия" },
  { value: "networking", label: "Нетворкинг" },
] as const;

export const GENDER_OPTIONS = [
  { value: "female", label: "Девушку" },
  { value: "male", label: "Мужчину" },
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

export const INTEREST_SECTIONS = [
  {
    title: "Образ жизни",
    items: ["спорт", "йога", "путешествия", "прогулки", "кофе", "кулинария"],
  },
  {
    title: "Культура",
    items: ["кино", "музыка", "книги", "театр", "музеи", "фотография"],
  },
  {
    title: "Технологии",
    items: ["дизайн", "стартапы", "программирование", "игры", "ai", "гаджеты"],
  },
  {
    title: "Общение",
    items: ["свидания", "дружба", "вечеринки", "настолки", "волонтерство", "языки"],
  },
  {
    title: "Интимные предпочтения",
    items: SEXUAL_INTERESTS.map((i) => i.label),
  },
] as const;

export function getDatingGoalLabel(value?: string | null) {
  return DATING_GOALS.find((goal) => goal.value === value)?.label ?? null;
}

export function getGenderLabel(value?: string | null) {
  return GENDER_OPTIONS.find((g) => g.value === value)?.label ?? null;
}
