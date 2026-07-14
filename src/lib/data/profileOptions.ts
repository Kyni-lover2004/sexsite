export const DATING_GOALS = [
  { value: "serious_relationship", label: "Серьезные отношения" },
  { value: "friendship", label: "Дружба и общение" },
  { value: "dates", label: "Свидания" },
  { value: "travel", label: "Попутчики и путешествия" },
  { value: "events", label: "Компания на мероприятия" },
  { value: "networking", label: "Нетворкинг" },
  { value: "chat", label: "Просто переписка" },
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
] as const;

export function getDatingGoalLabel(value?: string | null) {
  return DATING_GOALS.find((goal) => goal.value === value)?.label ?? null;
}
