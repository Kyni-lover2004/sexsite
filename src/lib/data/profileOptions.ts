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

export const LOOKING_FOR_OPTIONS = [
  { value: "married_couple_mf", label: "Семейная пара (м+ж)" },
  { value: "unmarried_couple_mf", label: "Несемейная пара (м+ж)" },
  { value: "man", label: "Мужчина" },
  { value: "woman", label: "Женщина" },
  { value: "two_girls_or_two_guys", label: "Две девушки / Два парня" },
] as const;

export const AGE_PREFERENCE_OPTIONS = [
  { value: "any", label: "Возраст значения не имеет" },
  { value: "same_age", label: "С людьми нашего (моего) возраста" },
  { value: "plus_minus_5", label: "Нашего (моего) возраста или с разницей +/- 5 лет" },
  { value: "plus_minus_10", label: "Нашего (моего) возраста или с разницей +/- 10 лет" },
] as const;

export const MEETING_PLACE_OPTIONS = [
  { value: "our_home", label: "У себя дома (пригласим к себе)" },
  { value: "their_home", label: "У вас дома (примем приглашение)" },
  { value: "club_party", label: "В свинг-клубе или на закрытой вечеринке" },
  { value: "sauna", label: "В сауне" },
  { value: "neutral", label: "На нейтральной территории (в гостинице или на съемной квартире)" },
] as const;

export const MOBILITY_OPTIONS = [
  { value: "none", label: "Не выезжаем(жаю) для встречи в другие города" },
  { value: "50km", label: "Приезд возможен, если расстояние не превышает 50км." },
  { value: "100km", label: "Приезд возможен, если расстояние не превышает 100км." },
  { value: "200km", label: "Приезд возможен, если расстояние не превышает 200км." },
  { value: "300km", label: "Приезд возможен, если расстояние не превышает 300км." },
  { value: "400km", label: "Приезд возможен, если расстояние не превышает 400км." },
  { value: "500km", label: "Приезд возможен, если расстояние не превышает 500км." },
  { value: "unlimited", label: "Расстояние не помеха" },
] as const;

export const SMOKING_ATTITUDE_OPTIONS = [
  { value: "non_smoker_intolerant", label: "Не курю и не переношу табачного дыма" },
  { value: "non_smoker_tolerant", label: "Не курю, но терпимо отношусь к табачному дыму" },
  { value: "smoker_can_abstain", label: "Курю, но могу обойтись какое-то время без сигарет" },
  { value: "smoker_cannot_abstain", label: "Не могу отказаться от курения ни при каких обстоятельствах" },
] as const;

export const DRINKING_ATTITUDE_OPTIONS = [
  { value: "none", label: "Не употребляю вообще" },
  { value: "insignificant", label: "В незначительных дозах, количество выпитого не отражается на моем поведении" },
  { value: "moderate", label: "Умеренно, до легкого опьянения, контролирую свое поведение" },
  { value: "heavy", label: "Могу напиться, потерять контроль над своим поведением" },
] as const;

export const ORIENTATION_ROLES = [
  { value: "hetero", label: "Гетеро" },
  { value: "bi", label: "Би" },
  { value: "lesbian", label: "Лесби" },
  { value: "active", label: "Актив" },
  { value: "passive", label: "Пассив" },
  { value: "switch", label: "Универсал / Смена ролей" },
] as const;

export function getDatingGoalLabel(value?: string | null) {
  return DATING_GOALS.find((goal) => goal.value === value)?.label ?? null;
}

export function getGenderLabel(value?: string | null) {
  return GENDER_OPTIONS.find((g) => g.value === value)?.label ?? null;
}

export function getLabel(options: readonly { value: string; label: string }[], value?: string | null) {
  return options.find((o) => o.value === value)?.label ?? null;
}
